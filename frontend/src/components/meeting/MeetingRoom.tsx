"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { copyText, useMediaQuery, useToast } from "@/lib/hooks";
import { SAMPLE_SPEAKER_ID, sampleChat } from "@/lib/sampleRoom";
import type { ChatMessage, Meeting } from "@/lib/types";
import { useRoom } from "@/lib/useRoom";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type Panel } from "./ControlBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ParticipantTile } from "./ParticipantTile";
import { RoomTopBar } from "./RoomTopBar";
import { useLocalCamera } from "./useLocalCamera";
import { VideoGrid } from "./VideoGrid";

type MeetingRoomProps = {
  code: string;
  meeting: Meeting;
  onLeave: (endedForAll: boolean) => void;
};

/** Dark meeting room: top bar, gallery, toolbar, side panel and host dialogs. */
export function MeetingRoom({ code, meeting, onLeave }: MeetingRoomProps) {
  const { participants, me, actions } = useRoom(code);

  const [panel, setPanel] = useState<Panel>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(sampleChat);
  const [unread, setUnread] = useState(sampleChat.length);
  const [allowSelfUnmute, setAllowSelfUnmute] = useState(true);
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [muteAllAllowUnmute, setMuteAllAllowUnmute] = useState(true);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const messageId = useRef(100);
  const toast = useToast();
  const micOn = me ? !me.is_muted : false;
  const camOn = me ? !me.is_video_off : false;
  const camera = useLocalCamera(camOn);
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (!me) return null;

  const selfId = me.id;
  const selfName = me.display_name;
  // Only the host can end the meeting. The host and co-hosts can mute and remove people.
  const isHost = me.role === "host";
  const canModerate = me.role === "host" || me.role === "co_host";
  const gridPeople = isPhone ? participants.filter((p) => p.id !== selfId) : participants;
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

  function leave() {
    actions.leave();
    onLeave(false);
  }

  async function endForAll() {
    if (ending) return;
    setEnding(true);
    const ok = await actions.endForAll();
    setEnding(false);
    if (ok) onLeave(true);
    else toast.show("Could not end the meeting. Try again.");
  }

  return (
    <div className="room flex h-dvh overflow-hidden bg-room-bg text-room-text">
      <div className="flex min-w-0 flex-1 flex-col">
        <RoomTopBar meeting={meeting} onCopied={toast.show} />

        <div className="relative min-h-0 flex-1">
          <VideoGrid
            participants={gridPeople}
            selfId={selfId}
            speakerId={SAMPLE_SPEAKER_ID}
            selfStream={camera.stream}
            reaction={reaction}
            aspect={isPhone ? 1 : 16 / 9}
          />
          {isPhone ? (
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
          onLeave={leave}
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
          onMute={actions.muteParticipant}
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
            <Button
              size="sm"
              onClick={() => {
                actions.muteAll();
                setAllowSelfUnmute(muteAllAllowUnmute);
                setMuteAllOpen(false);
                toast.show("All participants are muted");
              }}
            >
              Yes
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMuteAllOpen(false)}>
              No
            </Button>
          </>
        }
      >
        <p className="mb-3">Everyone except you will be muted.</p>
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
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (removeTarget) {
                  actions.removeParticipant(removeTarget.id);
                  toast.show(`${removeTarget.display_name} was removed`);
                }
                setRemoveId(null);
              }}
            >
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
