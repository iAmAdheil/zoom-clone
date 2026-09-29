"use client";

import { useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { copyText, useMediaQuery, useToast } from "@/lib/hooks";
import { ACTIVE_SPEAKER_ID, MOCK_NOW, SELF_ID, chatMessages, participants as mockParticipants } from "@/lib/mock";
import type { Meeting } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type Panel } from "./ControlBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ParticipantTile } from "./ParticipantTile";
import { RoomTopBar } from "./RoomTopBar";
import { roomReducer } from "./roomState";
import { useLocalCamera } from "./useLocalCamera";
import { VideoGrid } from "./VideoGrid";

type MeetingRoomProps = {
  meeting: Meeting;
  selfName: string;
  micOn: boolean;
  camOn: boolean;
  initialPanel: Panel;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: (endedForAll: boolean) => void;
};

/** Dark meeting room: top bar, gallery, toolbar, side panel and host dialogs. */
export function MeetingRoom(props: MeetingRoomProps) {
  const { meeting, selfName, micOn, camOn, initialPanel } = props;
  const isHost = true; // The demo user hosts every mock meeting.

  const [state, dispatch] = useReducer(roomReducer, undefined, () => ({
    participants: mockParticipants.map((p) =>
      p.id === SELF_ID ? { ...p, display_name: selfName } : p,
    ),
    messages: chatMessages,
    allowSelfUnmute: true,
  }));
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [unread, setUnread] = useState(initialPanel === "chat" ? 0 : chatMessages.length);
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [muteAllAllowUnmute, setMuteAllAllowUnmute] = useState(true);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const messageId = useRef(100);
  const toast = useToast();
  const camera = useLocalCamera(camOn);
  const isPhone = useMediaQuery("(max-width: 639px)");

  // Self state lives in the parent (it survives the pre-join step). Merge it in here.
  const people = state.participants.map((p) =>
    p.id === SELF_ID ? { ...p, is_muted: !micOn, is_video_off: !camOn } : p,
  );
  const self = people.find((p) => p.id === SELF_ID)!;
  const gridPeople = isPhone ? people.filter((p) => p.id !== SELF_ID) : people;
  const removeTarget = people.find((p) => p.id === removeId);

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((cur) => (cur === next ? null : next));
    if (next === "chat") setUnread(0);
  }

  function react(emoji: string) {
    setReaction({ emoji, key: Date.now() });
  }

  async function copyInvite() {
    const ok = await copyText(meeting.invite_link);
    toast.show(ok ? "Invite link copied" : "Copy blocked by the browser");
  }

  function sendMessage(text: string) {
    messageId.current += 1;
    dispatch({
      type: "send_message",
      message: { id: messageId.current, from: selfName, to: "Everyone", sent_at: MOCK_NOW, text },
    });
  }

  return (
    <div className="room flex h-dvh overflow-hidden bg-room-bg text-room-text">
      <div className="flex min-w-0 flex-1 flex-col">
        <RoomTopBar meeting={meeting} onCopied={toast.show} />

        <div className="relative min-h-0 flex-1">
          <VideoGrid
            participants={gridPeople}
            selfId={SELF_ID}
            speakerId={ACTIVE_SPEAKER_ID}
            selfStream={camera.stream}
            reaction={reaction}
            aspect={isPhone ? 1 : 16 / 9}
          />
          {isPhone ? (
            // Phones show the self view as a small floating tile, like the Zoom mobile app.
            <div className="absolute right-3 bottom-3 z-10 aspect-[3/4] w-24 rounded-md shadow-popover ring-1 ring-room-line">
              <ParticipantTile
                participant={self}
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
          participantCount={people.length}
          panelOpen={panel !== null}
          unreadChat={unread}
          isHost={isHost}
          onToggleMic={props.onToggleMic}
          onToggleCam={props.onToggleCam}
          onTogglePanel={togglePanel}
          onReact={react}
          onShare={() => toast.show("Screen sharing is not part of this mockup")}
          onCopyInvite={copyInvite}
          onLeave={() => props.onLeave(false)}
          onEndForAll={() => props.onLeave(true)}
        />
      </div>

      {panel === "participants" ? (
        <ParticipantsPanel
          meeting={meeting}
          participants={people}
          selfId={SELF_ID}
          isHost={isHost}
          allowSelfUnmute={state.allowSelfUnmute}
          onClose={() => setPanel(null)}
          onMute={(id) => dispatch({ type: "set_muted", id, value: true })}
          onAskUnmute={(id) => {
            const name = people.find((p) => p.id === id)?.display_name;
            toast.show(`Asked ${name} to unmute`);
          }}
          onRemove={setRemoveId}
          onMuteAll={() => setMuteAllOpen(true)}
          onToggleSelfUnmute={() => dispatch({ type: "toggle_self_unmute" })}
          onNotify={toast.show}
        />
      ) : null}
      {panel === "chat" ? (
        <ChatPanel
          messages={state.messages}
          selfName={selfName}
          onSend={sendMessage}
          onClose={() => setPanel(null)}
        />
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
                dispatch({ type: "mute_all", exceptId: SELF_ID, allowSelfUnmute: muteAllAllowUnmute });
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
                  dispatch({ type: "remove", id: removeTarget.id });
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
