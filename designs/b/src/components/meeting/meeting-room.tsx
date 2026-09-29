"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { MonitorUp } from "lucide-react";
import { Checkbox } from "@/components/ui/field";
import { chatMessages, roomParticipants } from "@/lib/mock";
import type { Meeting, RoomParticipant } from "@/lib/types";
import { ChatPanel } from "./chat-panel";
import { ControlBar, type Panel } from "./control-bar";
import { ParticipantsPanel } from "./participants-panel";
import { RoomDialog } from "./room-dialog";
import { roomReducer } from "./room-state";
import { RoomTopBar } from "./room-top-bar";
import { VideoGrid } from "./video-grid";
import type { FloatingReaction } from "./video-tile";

type MeetingRoomProps = {
  meeting: Meeting;
  displayName: string;
  initialMicOn: boolean;
  initialCamOn: boolean;
  initialPanel?: Panel;
  onLeave: (endedForAll: boolean) => void;
};

type Confirm = { kind: "mute_all" } | { kind: "remove"; participant: RoomParticipant } | null;

export function MeetingRoom({
  meeting,
  displayName,
  initialMicOn,
  initialCamOn,
  initialPanel = null,
  onLeave,
}: MeetingRoomProps) {
  const [state, dispatch] = useReducer(roomReducer, undefined, () => ({
    participants: roomParticipants.map((p) =>
      p.is_self ? { ...p, display_name: displayName, is_muted: !initialMicOn, is_video_off: !initialCamOn } : p,
    ),
    messages: chatMessages,
  }));
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [allowUnmute, setAllowUnmute] = useState(true);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [seenMessages, setSeenMessages] = useState(initialPanel === "chat" ? state.messages.length : 0);
  const nextReaction = useRef(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const self = state.participants.find((p) => p.is_self)!;
  const isHost = self.role === "host" || self.role === "co_host";
  const unreadChat = panel !== "chat" && state.messages.length > seenMessages;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Zoom shortcuts: Alt+A mutes, Alt+V toggles video.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.code === "KeyA") {
        e.preventDefault();
        dispatch({ type: "toggle_self_mic" });
      } else if (e.code === "KeyV") {
        e.preventDefault();
        dispatch({ type: "toggle_self_cam" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((cur) => (cur === next ? null : next));
    if (next === "chat") setSeenMessages(state.messages.length);
  }

  function react(emoji: string) {
    const id = nextReaction.current++;
    setReactions((list) => [...list, { id, emoji }]);
    setTimeout(() => setReactions((list) => list.filter((r) => r.id !== id)), 2400);
  }

  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const cancelConfirm = useCallback(() => setConfirm(null), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-room text-room-ink">
      {sharing ? (
        <div className="flex h-9 shrink-0 items-center justify-center gap-3 bg-share text-sm font-medium text-black">
          <MonitorUp className="size-4" />
          You are sharing your screen (mock)
          <button
            type="button"
            onClick={() => setSharing(false)}
            className="focus-ring-room rounded-md bg-danger px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-danger-hover"
          >
            Stop share
          </button>
        </div>
      ) : null}

      <RoomTopBar
        meeting={meeting}
        infoOpen={infoOpen}
        onToggleInfo={() => setInfoOpen((v) => !v)}
        onCloseInfo={closeInfo}
      />

      <div className="relative flex min-h-0 flex-1">
        <VideoGrid participants={state.participants} reactions={reactions} panelOpen={panel !== null} />

        {panel === "participants" ? (
          <ParticipantsPanel
            participants={state.participants}
            canManage={isHost}
            onClose={() => setPanel(null)}
            onMute={(p) => {
              dispatch({ type: "mute", id: p.id });
              showToast(`${p.display_name} is muted`);
            }}
            onAskUnmute={(p) => showToast(`Asked ${p.display_name} to unmute`)}
            onRemove={(p) => setConfirm({ kind: "remove", participant: p })}
            onMuteAll={() => setConfirm({ kind: "mute_all" })}
            onInvite={() => setInfoOpen(true)}
          />
        ) : null}

        {panel === "chat" ? (
          <ChatPanel
            messages={state.messages}
            onClose={() => setPanel(null)}
            onSend={(text) => {
              dispatch({ type: "send_message", text, sentAt: new Date().toISOString() });
              setSeenMessages(state.messages.length + 1);
            }}
          />
        ) : null}

        {toast ? (
          <div
            role="status"
            className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 animate-pop-in rounded-lg bg-room-3 px-4 py-2 text-sm whitespace-nowrap text-room-ink shadow-room-pop"
          >
            {toast}
          </div>
        ) : null}
      </div>

      <ControlBar
        muted={self.is_muted}
        videoOff={self.is_video_off}
        handRaised={Boolean(self.hand_raised)}
        sharing={sharing}
        isHost={self.role === "host"}
        participantCount={state.participants.length}
        panel={panel}
        unreadChat={unreadChat}
        onToggleMic={() => dispatch({ type: "toggle_self_mic" })}
        onToggleVideo={() => dispatch({ type: "toggle_self_cam" })}
        onTogglePanel={togglePanel}
        onToggleShare={() => setSharing((v) => !v)}
        onReact={react}
        onToggleHand={() => dispatch({ type: "toggle_self_hand" })}
        onShowInfo={() => setInfoOpen(true)}
        onLeave={onLeave}
      />

      {confirm?.kind === "mute_all" ? (
        <RoomDialog
          title="Mute all current and new participants?"
          confirmLabel="Mute all"
          onCancel={cancelConfirm}
          onConfirm={() => {
            dispatch({ type: "mute_all" });
            setConfirm(null);
            showToast(allowUnmute ? "Everyone is muted" : "Everyone is muted and cannot unmute");
          }}
        >
          <p>Hosts and co-hosts keep their audio.</p>
          <div className="mt-4 rounded-lg bg-room-2 p-3 [&_span]:text-room-ink">
            <Checkbox
              id="allow-unmute"
              label="Allow participants to unmute themselves"
              checked={allowUnmute}
              onChange={(e) => setAllowUnmute(e.target.checked)}
            />
          </div>
        </RoomDialog>
      ) : null}

      {confirm?.kind === "remove" ? (
        <RoomDialog
          title={`Remove ${confirm.participant.display_name}?`}
          confirmLabel="Remove"
          tone="danger"
          onCancel={cancelConfirm}
          onConfirm={() => {
            dispatch({ type: "remove", id: confirm.participant.id });
            setConfirm(null);
            showToast(`${confirm.participant.display_name} was removed`);
          }}
        >
          They leave the meeting now and cannot join again.
        </RoomDialog>
      ) : null}
    </div>
  );
}
