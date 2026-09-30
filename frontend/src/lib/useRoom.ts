"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { api } from "./api";
import { rejoinTokens, useMeetingSession } from "./meetingStore";
import { RoomSocket, type RoomStatus } from "./roomSocket";
import type { Participant, ServerEvent } from "./types";

// The one seam between the room UI and the realtime server.
//
// The hook opens the meeting WebSocket with the ws_ticket from the join response and keeps
// the participant list in a reducer. The server events (docs/api.md) change the list.
// Mute and video send WebSocket events. Host actions call the REST endpoints, and the server
// then sends the event to everyone. RoomSocket (roomSocket.ts) does the reconnect.
// WebRTC (lib/webrtc/usePeers.ts) uses `connectedIds`, `sendSignal` and `onSignal`.

export type { RoomStatus };

export type RoomActions = {
  setMuted: (muted: boolean) => void;
  setVideoOff: (videoOff: boolean) => void;
  /** Host or co-host: mute one participant. Resolves to false when the server says no. */
  muteParticipant: (id: number) => Promise<boolean>;
  /** Host or co-host: mute every attendee. */
  muteAll: () => Promise<boolean>;
  /** Host or co-host: remove a participant from the meeting. */
  removeParticipant: (id: number) => Promise<boolean>;
  /** Leave the meeting and go to the dashboard (a guest goes to /join). */
  leave: () => void;
  /** Host: end the meeting for everyone. Resolves to false when the server says no. */
  endForAll: () => Promise<boolean>;
  /** After status "failed": try to connect again. */
  retry: () => void;
};

/** Gets the `from` id and the raw `data` of each `signal` event. */
export type SignalListener = (from: number, data: unknown) => void;

export type Room = {
  participants: Participant[];
  me: Participant | null;
  status: RoomStatus;
  actions: RoomActions;
  /** `connected_ids` of the latest snapshot. A new array after each snapshot (also after a reconnect). */
  connectedIds: readonly number[] | null;
  /** Sends a WebRTC `signal` to one participant. False before the snapshot or while offline. Stable. */
  sendSignal: (to: number, data: Record<string, unknown>) => boolean;
  /** Subscribes to `signal` events. Returns the unsubscribe function. Stable. */
  onSignal: (listener: SignalListener) => () => void;
};

type SelfState = Pick<Participant, "is_muted" | "is_video_off">;

type RoomAction =
  | { type: "snapshot"; participants: Participant[]; selfId: number; self: SelfState }
  | { type: "upsert"; participant: Participant }
  | { type: "left"; id: number; selfId: number }
  | { type: "mute_all"; ids: number[] }
  | { type: "self"; id: number; change: Partial<SelfState> };

/** Applies one change to the list. */
function roomReducer(list: Participant[], action: RoomAction): Participant[] {
  switch (action.type) {
    case "snapshot":
      // My own mute and video choice wins. useRoom sends it to the server next.
      return action.participants.map((p) => (p.id === action.selfId ? { ...p, ...action.self } : p));
    case "upsert": {
      // An event can repeat a row that the snapshot already has (docs/api.md), so upsert by id.
      const index = list.findIndex((p) => p.id === action.participant.id);
      return index === -1 ? [...list, action.participant] : list.with(index, action.participant);
    }
    case "left":
      // I stay in my own list. The close code of my socket says why I am out.
      return action.id === action.selfId ? list : list.filter((p) => p.id !== action.id);
    case "mute_all": {
      const ids = new Set(action.ids);
      return list.map((p) => (ids.has(p.id) ? { ...p, is_muted: true } : p));
    }
    case "self":
      return list.map((p) => (p.id === action.id ? { ...p, ...action.change } : p));
  }
}

/** Calls a REST host action. The server sends the event, so the list changes from the socket. */
async function attempt(call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch {
    return false;
  }
}

/**
 * The live room of meeting `code`. `onNotice` gets short messages for the UI,
 * for example "The host muted you".
 */
export function useRoom(code: string, onNotice?: (message: string) => void): Room {
  const router = useRouter();
  const session = useMeetingSession(code);
  const selfId = session?.participant.id ?? null;
  const ticket = session?.ws_ticket ?? null;

  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [connectedIds, setConnectedIds] = useState<readonly number[] | null>(null);
  const [signalListeners] = useState(() => new Set<SignalListener>());
  const [participants, dispatch] = useReducer(roomReducer, session, (s) =>
    s ? [{ ...s.participant, is_muted: !s.micOn, is_video_off: !s.camOn }] : [],
  );
  const socketRef = useRef<RoomSocket | null>(null);
  // My latest mute and video state. Handlers read it before React renders again.
  const selfRef = useRef<SelfState>({ is_muted: !session?.micOn, is_video_off: !session?.camOn });
  // How many of my own set_* events still wait for their participant_updated echo.
  const pendingEchoes = useRef(0);

  const notify = useEffectEvent((message: string) => onNotice?.(message));

  /** Sends my state for the fields where the server row differs from it. */
  const sendSelf = useEffectEvent((server: Participant | undefined) => {
    const socket = socketRef.current;
    const self = selfRef.current;
    if (!socket || !server) return;
    if (server.is_muted !== self.is_muted && socket.send({ type: "set_muted", value: self.is_muted }))
      pendingEchoes.current += 1;
    if (server.is_video_off !== self.is_video_off && socket.send({ type: "set_video_off", value: self.is_video_off }))
      pendingEchoes.current += 1;
  });

  const onServerEvent = useEffectEvent((event: ServerEvent) => {
    if (selfId === null) return;
    switch (event.type) {
      case "snapshot":
        pendingEchoes.current = 0;
        dispatch({ type: "snapshot", participants: event.participants, selfId, self: selfRef.current });
        setConnectedIds(event.connected_ids);
        sendSelf(event.participants.find((p) => p.id === selfId));
        return;
      case "participant_joined":
      case "participant_updated": {
        const p = event.participant;
        if (p.id === selfId) {
          const echo = event.type === "participant_updated" && pendingEchoes.current > 0;
          if (echo) pendingEchoes.current -= 1;
          else if (p.is_muted && !selfRef.current.is_muted) notify("The host muted you");
          selfRef.current = { is_muted: p.is_muted, is_video_off: p.is_video_off };
        }
        dispatch({ type: "upsert", participant: p });
        return;
      }
      case "participant_left":
        dispatch({ type: "left", id: event.participant_id, selfId });
        return;
      case "mute_all":
        if (event.participant_ids.includes(selfId) && !selfRef.current.is_muted) {
          selfRef.current = { ...selfRef.current, is_muted: true };
          notify("The host muted everyone");
        }
        dispatch({ type: "mute_all", ids: event.participant_ids });
        return;
      case "signal":
        for (const listener of signalListeners) listener(event.from, event.data);
        return;
      case "error":
        console.warn(`Room event refused: ${event.code}: ${event.detail}`);
        return;
      default:
        // you_were_removed and meeting_ended change the status (see RoomSocket).
        return;
    }
  });

  /** Joins again with the rejoin token. The server gives back the same row and a new ticket. */
  const renewTicket = useEffectEvent(async () => {
    if (!session) throw new Error("No meeting session.");
    const result = await api.join(code, {
      display_name: session.participant.display_name,
      passcode: session.passcode,
      rejoin_token: rejoinTokens.read(code) ?? session.rejoin_token,
    });
    rejoinTokens.write(code, result.rejoin_token);
    return result.ws_ticket;
  });

  useEffect(() => {
    if (!ticket) return;
    const socket = new RoomSocket({
      code,
      onEvent: (event) => onServerEvent(event),
      onStatus: setStatus,
      renewTicket: () => renewTicket(),
    });
    socketRef.current = socket;
    // React strict mode runs this effect, its cleanup, and the effect again at once.
    // The timer lets the cleanup cancel the first run before it sends the one-use ticket.
    const timer = setTimeout(() => socket.start(ticket), 0);
    return () => {
      clearTimeout(timer);
      socket.dispose();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [code, ticket]);

  const sendSignal = useCallback(
    (to: number, data: Record<string, unknown>) => socketRef.current?.send({ type: "signal", to, data }) ?? false,
    [],
  );

  const onSignal = useCallback(
    (listener: SignalListener) => {
      signalListeners.add(listener);
      return () => {
        signalListeners.delete(listener);
      };
    },
    [signalListeners],
  );

  const me = participants.find((p) => p.id === selfId) ?? null;

  function setSelf(change: Partial<SelfState>) {
    if (selfId === null) return;
    selfRef.current = { ...selfRef.current, ...change };
    dispatch({ type: "self", id: selfId, change });
  }

  const actions: RoomActions = {
    setMuted: (value) => {
      setSelf({ is_muted: value });
      if (socketRef.current?.send({ type: "set_muted", value })) pendingEchoes.current += 1;
    },
    setVideoOff: (value) => {
      setSelf({ is_video_off: value });
      if (socketRef.current?.send({ type: "set_video_off", value })) pendingEchoes.current += 1;
    },
    muteParticipant: (id) => attempt(() => api.muteParticipant(code, id)),
    muteAll: () => attempt(() => api.muteAll(code)),
    removeParticipant: (id) => attempt(() => api.removeParticipant(code, id)),
    leave: () => {
      socketRef.current?.leave();
      router.push(session?.participant.user_id === null ? "/join" : "/");
    },
    endForAll: () => attempt(() => api.endMeeting(code)),
    retry: () => socketRef.current?.retry(),
  };

  return { participants, me, status, actions, connectedIds, sendSignal, onSignal };
}
