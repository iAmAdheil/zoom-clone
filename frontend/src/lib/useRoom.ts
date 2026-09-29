"use client";

import { useReducer } from "react";
import { api } from "./api";
import { useMeetingSession } from "./meetingStore";
import { sampleParticipants } from "./sampleRoom";
import type { Participant } from "./types";

// The one seam between the room UI and the realtime server.
//
// Stage 1 (now): the list is the real participant from the join response plus sample people.
// Mute, video and host actions change local state. "End for all" calls the REST endpoint.
// Stage 2: this hook opens the WebSocket with the ws_ticket, applies the server events
// (snapshot, participant_joined, participant_updated, ...) in the reducer, and sends
// set_muted / set_video_off / leave. The components that call useRoom do not change.

export type RoomActions = {
  setMuted: (muted: boolean) => void;
  setVideoOff: (videoOff: boolean) => void;
  /** Host or co-host: mute one participant. */
  muteParticipant: (id: number) => void;
  /** Host or co-host: mute everyone except me. */
  muteAll: () => void;
  /** Host or co-host: remove a participant from the meeting. */
  removeParticipant: (id: number) => void;
  /** Leave the meeting. The meeting goes on for the others. */
  leave: () => void;
  /** Host: end the meeting for everyone. Resolves to false when the server says no. */
  endForAll: () => Promise<boolean>;
};

export type Room = {
  participants: Participant[];
  me: Participant | null;
  actions: RoomActions;
};

type RoomAction =
  | { type: "set_muted"; id: number; value: boolean }
  | { type: "set_video_off"; id: number; value: boolean }
  | { type: "mute_all"; exceptId: number }
  | { type: "remove"; id: number };

/** Applies one change to the list. The actions match the WebSocket events in docs/api.md. */
function roomReducer(participants: Participant[], action: RoomAction): Participant[] {
  switch (action.type) {
    case "set_muted":
      return participants.map((p) => (p.id === action.id ? { ...p, is_muted: action.value } : p));
    case "set_video_off":
      return participants.map((p) => (p.id === action.id ? { ...p, is_video_off: action.value } : p));
    case "mute_all":
      return participants.map((p) => (p.id === action.exceptId ? p : { ...p, is_muted: true }));
    case "remove":
      return participants.filter((p) => p.id !== action.id);
  }
}

export function useRoom(code: string): Room {
  const session = useMeetingSession(code);
  const [participants, dispatch] = useReducer(roomReducer, session, (s) =>
    s
      ? [
          { ...s.participant, is_muted: !s.micOn, is_video_off: !s.camOn },
          ...sampleParticipants,
        ]
      : [],
  );

  const meId = session?.participant.id ?? null;
  const me = participants.find((p) => p.id === meId) ?? null;

  const actions: RoomActions = {
    setMuted: (value) => {
      if (meId !== null) dispatch({ type: "set_muted", id: meId, value });
    },
    setVideoOff: (value) => {
      if (meId !== null) dispatch({ type: "set_video_off", id: meId, value });
    },
    muteParticipant: (id) => dispatch({ type: "set_muted", id, value: true }),
    muteAll: () => {
      if (meId !== null) dispatch({ type: "mute_all", exceptId: meId });
    },
    removeParticipant: (id) => dispatch({ type: "remove", id }),
    leave: () => {},
    endForAll: async () => {
      try {
        await api.endMeeting(code);
        return true;
      } catch {
        return false;
      }
    },
  };

  return { participants, me, actions };
}
