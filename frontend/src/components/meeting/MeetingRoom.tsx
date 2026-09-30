"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { copyText, useMediaQuery, useToast } from "@/lib/hooks";
import type { ChatMessage, Meeting } from "@/lib/types";
import { useRoom } from "@/lib/useRoom";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type Panel } from "./ControlBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ParticipantTile } from "./ParticipantTile";
import { RoomExitNotice } from "./RoomExitNotice";
import { RoomTopBar } from "./RoomTopBar";
import { useLocalCamera, useLocalMedia } from "./useLocalMedia";
import { VideoGrid } from "./VideoGrid";

type MeetingRoomProps = {
  code: string;
  meeting: Meeting;
  /** The host ended the meeting for everyone (the REST call worked). */
  onEndedForAll: () => void;
};

/** Dark meeting room: top bar, gallery, toolbar, side panel and host dialogs. */
export function MeetingRoom({ code, meeting, onEndedForAll }: MeetingRoomProps) {
  const toast = useToast(3500);
  const { participants, me, status, actions } = useRoom(code, toast.show);

  const [panel, setPanel] = useState<Panel>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [allowSelfUnmute, setAllowSelfUnmute] = useState(true);
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [muteAllAllowUnmute, setMuteAllAllowUnmute] = useState(true);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const messageId = useRef(0);
  const isPhone = useMediaQuery("(max-width: 639px)");

  // The server state drives the real tracks: a host mute also stops my microphone.
  // When the room closes (removed, ended, lost), both devices are released.
  const inRoom = status === "connecting" || status === "live" || status === "reconnecting";
  const micOn = me ? !me.is_muted : false;
  const camOn = me ? !me.is_video_off : false;
  const camera = useLocalCamera(inRoom && camOn);
  useLocalMedia("audio", inRoom && micOn);

  if (!me) return null;

  const isGuest = me.user_id === null;
  if (!inRoom) {
    return <RoomExitNotice status={status} title={meeting.title} isGuest={isGuest} onRetry={actions.retry} />;
  }

  const selfId = me.id;
  const selfName = me.display_name;
  // Only the host can end the meeting. The host and co-hosts can mute and remove people.
  const isHost = me.role === "host";
  const canModerate = me.role === "host" || me.role === "co_host";
  // Phones show me as a small floating tile, unless I am alone in the meeting.
  const floatSelf = isPhone && participants.length > 1;
  const gridPeople = floatSelf ? participants.filter((p) => p.id !== selfId) : participants;
  const removeTarget = participants.find((p) => p.id === removeId);

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((cur) => (cur === next ? null : next));
    if (next === "chat") setUnread(0);
  }

  async function copyInvite() {
    const ok = await copyText(meeting.invite_link);
    toast.show(ok ? "Invite link copied" : "Copy blocked by the browser");
  }

  function sendMessage(text: string) {
    messageId.current += 1;
    const message: ChatMessage = {
      id: messageId.current,
      from: selfName,
      to: "Everyone",
      sent_at: new Date().toISOString(),
      text,
    };
    setMessages((prev) => [...prev, message]);
  }

  async function endForAll() {
    if (ending) return;
    setEnding(true);
    const ok = await actions.endForAll();
    setEnding(false);
    if (ok) onEndedForAll();
    else toast.show("Could not end the meeting. Try again.");
  }

  async function muteOne(id: number) {
    const name = participants.find((p) => p.id === id)?.display_name ?? "The participant";
    if (!(await actions.muteParticipant(id))) toast.show(`Could not mute ${name}. Try again.`);
  }

  async function muteEveryone() {
    setMuteAllOpen(false);
    setAllowSelfUnmute(muteAllAllowUnmute);
    const ok = await actions.muteAll();
    toast.show(ok ? "All participants are muted" : "Could not mute everyone. Try again.");
  }

  async function removeOne() {
    setRemoveId(null);
    if (!removeTarget) return;
    const ok = await actions.removeParticipant(removeTarget.id);
    toast.show(ok ? `${removeTarget.display_name} was removed` : `Could not remove ${removeTarget.display_name}.`);
  }

  return (
    <div className="room flex h-dvh overflow-hidden bg-room-bg text-room-text">
      <div className="flex min-w-0 flex-1 flex-col">
        <RoomTopBar meeting={meeting} onCopied={toast.show} />

        <div className="relative min-h-0 flex-1">
          <VideoGrid
            participants={gridPeople}
            selfId={selfId}
            speakerId={null}
            selfStream={camera.stream}
            reaction={reaction}
            aspect={isPhone ? 1 : 16 / 9}
          />
          {floatSelf ? (
            // Phones show the self view as a small floating tile, like the Zoom mobile app.
            <div className="absolute right-3 bottom-3 z-10 aspect-[3/4] w-24 rounded-md shadow-popover ring-1 ring-room-line">
              <ParticipantTile
                participant={me}
                isSelf
                speaking={false}
                stream={camera.stream}
                reaction={reaction}
                className="size-full"
              />
            </div>
          ) : null}
          {status === "reconnecting" ? (
            <p
              role="status"
              className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-md bg-room-popover px-4 py-2 text-sm font-bold shadow-popover"
            >
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-room-muted border-t-room-text" />
              Reconnecting...
            </p>
          ) : null}
        </div>

        <ControlBar
          micOn={micOn}
          camOn={camOn}
          panel={panel}
          participantCount={participants.length}
          panelOpen={panel !== null}
          unreadChat={unread}
          isHost={isHost}
          onToggleMic={() => actions.setMuted(micOn)}
          onToggleCam={() => actions.setVideoOff(camOn)}
          onTogglePanel={togglePanel}
          onReact={(emoji) => setReaction({ emoji, key: Date.now() })}
          onShare={() => toast.show("Screen sharing is not available yet")}
          onCopyInvite={copyInvite}
          onLeave={actions.leave}
          onEndForAll={endForAll}
        />
      </div>

      {panel === "participants" ? (
        <ParticipantsPanel
          meeting={meeting}
          participants={participants}
          selfId={selfId}
          isHost={canModerate}
          allowSelfUnmute={allowSelfUnmute}
          onClose={() => setPanel(null)}
          onMute={muteOne}
          onAskUnmute={(id) => {
            const name = participants.find((p) => p.id === id)?.display_name;
            toast.show(`Asked ${name} to unmute`);
          }}
          onRemove={setRemoveId}
          onMuteAll={() => setMuteAllOpen(true)}
          onToggleSelfUnmute={() => setAllowSelfUnmute((v) => !v)}
          onNotify={toast.show}
        />
      ) : null}
      {panel === "chat" ? (
        <ChatPanel messages={messages} selfName={selfName} onSend={sendMessage} onClose={() => setPanel(null)} />
      ) : null}

      <Modal
        open={muteAllOpen}
        onClose={() => setMuteAllOpen(false)}
        title="Mute all current and new participants"
        footer={
          <>
            <Button size="sm" onClick={muteEveryone}>
              Yes
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMuteAllOpen(false)}>
              No
            </Button>
          </>
        }
      >
        <p className="mb-3">Everyone except the host and co-hosts will be muted.</p>
        <Check
          id="allow-unmute"
          label="Allow participants to unmute themselves"
          checked={muteAllAllowUnmute}
          onChange={(e) => setMuteAllAllowUnmute(e.target.checked)}
        />
      </Modal>

      <Modal
        open={removeTarget !== undefined}
        onClose={() => setRemoveId(null)}
        title={`Remove ${removeTarget?.display_name ?? ""}?`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={removeOne}>
              Remove
            </Button>
          </>
        }
      >
        They leave the meeting now and cannot join it again.
      </Modal>

      <Toast message={toast.message} offset="bottom-24" />
    </div>
  );
}
