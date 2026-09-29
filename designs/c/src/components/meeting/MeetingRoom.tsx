"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ACTIVE_SPEAKER_ID, chatMessages, roomParticipants, SELF_ID } from "@/lib/mock";
import type { ChatMessage, Meeting, Participant } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type PanelName } from "./ControlBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { LeaveMenu } from "./RoomMenus";
import { RoomTopBar } from "./RoomTopBar";
import { VideoGrid } from "./VideoGrid";

type MeetingRoomProps = {
  meeting: Meeting;
  startMuted: boolean;
  startVideoOff: boolean;
  initialPanel: PanelName | null;
};

/** Short message at the top of the room. Clears itself. */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}

export function MeetingRoom({ meeting, startMuted, startVideoOff, initialPanel }: MeetingRoomProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>(() =>
    roomParticipants.map((p) =>
      p.id === SELF_ID ? { ...p, is_muted: startMuted, is_video_off: startVideoOff } : p,
    ),
  );
  const [panel, setPanel] = useState<PanelName | null>(initialPanel);
  const [sharing, setSharing] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<number>>(() => new Set([5]));
  const [reactions, setReactions] = useState<Record<number, string | undefined>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [unread, setUnread] = useState(initialPanel === "chat" ? 0 : 2);
  const [toast, setToast] = useToast();
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const self = participants.find((p) => p.id === SELF_ID)!;
  const isHost = self.role === "host";

  function update(id: number, patch: Partial<Participant>) {
    setParticipants((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function togglePanel(name: PanelName) {
    setPanel((cur) => (cur === name ? null : name));
    if (name === "chat") setUnread(0);
  }

  function react(emoji: string) {
    // Clear first so the same emoji twice still plays the animation.
    setReactions((r) => ({ ...r, [SELF_ID]: undefined }));
    requestAnimationFrame(() => setReactions((r) => ({ ...r, [SELF_ID]: emoji })));
  }

  // Remove the reaction after the float animation ends.
  const selfReaction = reactions[SELF_ID];
  useEffect(() => {
    if (!selfReaction) return;
    const t = setTimeout(() => setReactions((r) => ({ ...r, [SELF_ID]: undefined })), 2600);
    return () => clearTimeout(t);
  }, [selfReaction]);

  function toggleHand() {
    setRaisedHands((prev) => {
      const next = new Set(prev);
      if (next.has(SELF_ID)) next.delete(SELF_ID);
      else next.add(SELF_ID);
      return next;
    });
  }

  function toggleParticipantMute(id: number) {
    const p = participants.find((x) => x.id === id)!;
    if (p.is_muted) {
      setToast(`Asked ${p.display_name} to unmute`);
    } else {
      update(id, { is_muted: true });
      setToast(`You muted ${p.display_name}`);
    }
  }

  function confirmRemove() {
    if (!removeTarget) return;
    setParticipants((list) => list.filter((p) => p.id !== removeTarget.id));
    setToast(`${removeTarget.display_name} was removed`);
    setRemoveTarget(null);
  }

  function confirmMuteAll() {
    setParticipants((list) => list.map((p) => (p.role === "attendee" ? { ...p, is_muted: true } : p)));
    setMuteAllOpen(false);
    setToast("Everyone else is muted");
  }

  function send(text: string) {
    setMessages((m) => [
      ...m,
      { id: m.length + 1, from: self.display_name, text, at: new Date().toISOString() },
    ]);
  }

  const leave = () => router.push("/");

  return (
    <div data-theme="dark" className="flex h-dvh flex-col overflow-hidden bg-room text-room-ink">
      <RoomTopBar meeting={meeting} onEnd={() => setLeaveOpen(true)} />

      {sharing && (
        <div className="mx-2 mb-1 flex items-center justify-center gap-3 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white sm:mx-4">
          <Icon name="share" size={16} />
          You are sharing your screen
          <button
            type="button"
            onClick={() => setSharing(false)}
            className="rounded-sm bg-danger px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-danger-hover"
          >
            Stop Share
          </button>
        </div>
      )}

      <main id="main" className="flex min-h-0 flex-1">
        <VideoGrid
          participants={participants}
          selfId={SELF_ID}
          speakerId={ACTIVE_SPEAKER_ID}
          reactions={reactions}
          raisedHands={raisedHands}
        />
        {panel === "participants" && (
          <ParticipantsPanel
            participants={participants}
            selfId={SELF_ID}
            isHost={isHost}
            inviteLink={meeting.invite_link}
            onClose={() => setPanel(null)}
            onToggleMute={toggleParticipantMute}
            onRemove={setRemoveTarget}
            onMuteAll={() => setMuteAllOpen(true)}
          />
        )}
        {panel === "chat" && (
          <ChatPanel
            messages={messages}
            selfName={self.display_name}
            onSend={send}
            onClose={() => setPanel(null)}
          />
        )}
      </main>

      <ControlBar
        muted={self.is_muted}
        videoOff={self.is_video_off}
        sharing={sharing}
        handRaised={raisedHands.has(SELF_ID)}
        panel={panel}
        participantCount={participants.length}
        unreadChat={unread}
        isHost={isHost}
        onToggleMute={() => update(SELF_ID, { is_muted: !self.is_muted })}
        onToggleVideo={() => update(SELF_ID, { is_video_off: !self.is_video_off })}
        onToggleShare={() => setSharing((s) => !s)}
        onTogglePanel={togglePanel}
        onReact={react}
        onToggleHand={toggleHand}
        onEndForAll={leave}
        onLeave={leave}
      />

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed top-14 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full bg-room-raised px-4 py-2 text-sm text-room-ink shadow-pop-dark"
        >
          {toast}
        </div>
      )}

      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.display_name ?? ""}?`}
        footer={
          <>
            <Button variant="dark" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      >
        They leave the meeting now and can&apos;t join again with this link.
      </Dialog>

      <Dialog
        open={muteAllOpen}
        onClose={() => setMuteAllOpen(false)}
        title="Mute all current and new participants?"
        footer={
          <>
            <Button variant="dark" onClick={() => setMuteAllOpen(false)}>
              No
            </Button>
            <Button onClick={confirmMuteAll}>Yes</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p>Everyone except you and co-hosts will be muted.</p>
          <Checkbox
            id="allow-unmute"
            tone="dark"
            defaultChecked
            label="Allow participants to unmute themselves"
          />
        </div>
      </Dialog>

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave this meeting?">
        <LeaveMenu isHost={isHost} onEndForAll={leave} onLeave={leave} />
      </Dialog>
    </div>
  );
}
