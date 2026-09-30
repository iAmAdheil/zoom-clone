"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { copyText, useMediaQuery, useToast } from "@/lib/hooks";
import type { Meeting } from "@/lib/types";
import { useRoom } from "@/lib/useRoom";
import { unlockAudio, useAudioBlocked } from "@/lib/webrtc/audioPlayback";
import { canListDevices, useDeviceChoices } from "@/lib/webrtc/devices";
import { deviceToast } from "@/lib/webrtc/mediaAccess";
import { useMicProblem } from "@/lib/webrtc/micLevel";
import type { MediaKind } from "@/lib/webrtc/peerManager";
import { useTrackToggles, type LocalMedia } from "@/lib/webrtc/useMedia";
import { usePeers } from "@/lib/webrtc/usePeers";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type DeviceMenu, type Panel } from "./ControlBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ParticipantTile } from "./ParticipantTile";
import { RoomExitNotice } from "./RoomExitNotice";
import { RoomTopBar } from "./RoomTopBar";
import { RemoteAudio } from "./VideoFeed";
import { VideoGrid } from "./VideoGrid";

type MeetingRoomProps = {
  code: string;
  meeting: Meeting;
  /** The camera and microphone from the pre-join preview. The room opens them only when the user asks. */
  media: LocalMedia;
  /** The chosen speaker for the remote sound. "" is the system default. */
  speakerId: string;
  onSpeakerChange: (id: string) => void;
  /** The host ended the meeting for everyone (the REST call worked). */
  onEndedForAll: () => void;
  /** False when the server closed the room (removed, ended, lost). The parent then stops the devices. */
  onActiveChange: (active: boolean) => void;
};

const DEVICE_NAME: Record<MediaKind, string> = { audio: "Microphone", video: "Camera" };
const noSubscribe = () => () => {};

/** Dark meeting room: top bar, gallery, toolbar, side panel and host dialogs. */
export function MeetingRoom({
  code,
  meeting,
  media,
  speakerId,
  onSpeakerChange,
  onEndedForAll,
  onActiveChange,
}: MeetingRoomProps) {
  const toast = useToast(3500);
  const room = useRoom(code, toast.show);
  const { participants, me, status, actions, chat } = room;
  const peers = usePeers(room, media.stream);
  const soundBlocked = useAudioBlocked();
  const choices = useDeviceChoices(media.stream);
  const showDeviceMenus = useSyncExternalStore(noSubscribe, canListDevices, () => false);

  const [panel, setPanel] = useState<Panel>(null);
  const [allowSelfUnmute, setAllowSelfUnmute] = useState(true);
  const [reaction, setReaction] = useState<{ emoji: string; key: number } | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [muteAllAllowUnmute, setMuteAllAllowUnmute] = useState(true);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const isPhone = useMediaQuery("(max-width: 639px)");

  // Unread messages count only while the chat panel is closed.
  const chatOpen = panel === "chat";
  const reportChatOpen = useEffectEvent((open: boolean) => actions.setChatOpen(open));
  useEffect(() => {
    reportChatOpen(chatOpen);
  }, [chatOpen]);

  // The server state drives the real tracks: a host mute also stops my microphone.
  // When the room closes (removed, ended, lost), the parent releases both devices.
  const inRoom = status === "connecting" || status === "live" || status === "reconnecting";
  const micOn = me ? !me.is_muted : false;
  const camOn = me ? !me.is_video_off : false;
  useTrackToggles(media.stream, micOn, camOn);
  const micProblem = useMicProblem(media.stream, micOn && media.hasAudio);
  const reportActive = useEffectEvent(onActiveChange);
  useEffect(() => {
    reportActive(inRoom);
  }, [inRoom]);

  // A device that stops (unplugged, or taken by the system) turns me muted or video off for
  // everyone. So the others never see "unmuted" while no sound can come.
  const syncLostDevice = useEffectEvent((kind: MediaKind) => {
    if (kind === "audio" && micOn) actions.setMuted(true);
    if (kind === "video" && camOn) actions.setVideoOff(true);
  });
  const audioLost = inRoom && micOn && !media.hasAudio;
  const videoLost = inRoom && camOn && !media.hasVideo;
  useEffect(() => {
    if (audioLost) syncLostDevice("audio");
  }, [audioLost]);
  useEffect(() => {
    if (videoLost) syncLostDevice("video");
  }, [videoLost]);

  if (!me) return null;

  const isGuest = me.user_id === null;
  if (!inRoom) {
    return <RoomExitNotice status={status} title={meeting.title} isGuest={isGuest} onRetry={actions.retry} />;
  }

  const selfId = me.id;
  // Only the host can end the meeting. The host and co-hosts can mute and remove people.
  const isHost = me.role === "host";
  const canModerate = me.role === "host" || me.role === "co_host";
  // Phones show me as a small floating tile, unless I am alone in the meeting.
  const floatSelf = isPhone && participants.length > 1;
  const gridPeople = floatSelf ? participants.filter((p) => p.id !== selfId) : participants;
  const removeTarget = participants.find((p) => p.id === removeId);

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((cur) => (cur === next ? null : next));
  }

  /**
   * Mute and video toggles. With no open device, the tap asks the browser for it (inside the
   * tap, for mobile browsers). The new track goes to every peer with no reload.
   */
  async function toggleDevice(kind: MediaKind) {
    const on = kind === "audio" ? micOn : camOn;
    const available = kind === "audio" ? media.hasAudio : media.hasVideo;
    const setOff = kind === "audio" ? actions.setMuted : actions.setVideoOff;
    if (on || available) {
      setOff(on);
      return;
    }
    const result = await media.request([kind]);
    if (result[kind] === "ok") setOff(false);
    else toast.show(deviceToast(kind, result[kind]));
  }

  async function allowDevice(kind: MediaKind) {
    const result = await media.request([kind]);
    if (result[kind] !== "ok") toast.show(deviceToast(kind, result[kind]));
    else if (kind === "audio") toast.show("The microphone is ready. Click Unmute to talk.");
    else toast.show("The camera is ready. Click Start Video.");
  }

  async function chooseDevice(kind: MediaKind, id: string) {
    if (!(await media.selectDevice(kind, id))) toast.show(`Could not open that ${DEVICE_NAME[kind].toLowerCase()}.`);
  }

  const audioMenu: DeviceMenu = {
    groups: [
      { label: "Select a Microphone", options: choices.mics, selectedId: choices.micId, onSelect: (id) => void chooseDevice("audio", id) },
      { label: "Select a Speaker", options: choices.speakers, selectedId: speakerId || "default", onSelect: onSpeakerChange },
    ],
    actions: media.hasAudio ? [] : [{ label: "Allow microphone", onSelect: () => void allowDevice("audio") }],
  };
  const videoMenu: DeviceMenu = {
    groups: [
      { label: "Select a Camera", options: choices.cams, selectedId: choices.camId, onSelect: (id) => void chooseDevice("video", id) },
    ],
    actions: media.hasVideo ? [] : [{ label: "Allow camera", onSelect: () => void allowDevice("video") }],
  };

  async function copyInvite() {
    const ok = await copyText(meeting.invite_link);
    toast.show(ok ? "Invite link copied" : "Copy blocked by the browser");
  }

  function sendMessage(text: string, to: number | null) {
    const sent = actions.sendChat(text, to);
    if (!sent) toast.show("You are offline. Your message was not sent.");
    return sent;
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
          {/* The sound of each remote participant. It plays even when their video is off. */}
          {[...peers.streams].map(([id, stream]) => (
            <RemoteAudio key={id} stream={stream} participantId={id} speakerId={speakerId} />
          ))}
          <VideoGrid
            participants={gridPeople}
            selfId={selfId}
            selfStream={media.stream}
            selfMicProblem={micProblem}
            peers={peers}
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
                stream={media.stream}
                reaction={reaction}
                micProblem={micProblem}
                className="size-full"
              />
            </div>
          ) : null}
          <div className="absolute top-3 left-1/2 z-20 flex w-max max-w-[calc(100%-24px)] -translate-x-1/2 flex-col items-center gap-2">
            {soundBlocked ? (
              // The browser refused to play the remote sound. A click here counts as the user's
              // permission, so the sound starts. Any other click on the page does it too.
              <button
                type="button"
                onClick={unlockAudio}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-white shadow-popover transition-colors hover:bg-primary-hover"
              >
                <Icon name="alert" size={16} className="shrink-0" />
                Sound is blocked. Click to turn on sound
              </button>
            ) : null}
            {status === "reconnecting" ? (
              <p
                role="status"
                className="flex items-center gap-2 rounded-md bg-room-popover px-4 py-2 text-sm font-bold shadow-popover"
              >
                <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-room-muted border-t-room-text" />
                Reconnecting...
              </p>
            ) : null}
          </div>
        </div>

        <ControlBar
          micOn={micOn && media.hasAudio}
          camOn={camOn && media.hasVideo}
          micAvailable={media.hasAudio}
          camAvailable={media.hasVideo}
          audioMenu={audioMenu}
          videoMenu={videoMenu}
          showDeviceMenus={showDeviceMenus}
          panel={panel}
          participantCount={participants.length}
          panelOpen={panel !== null}
          unreadChat={chat.unread}
          isHost={isHost}
          onToggleMic={() => void toggleDevice("audio")}
          onToggleCam={() => void toggleDevice("video")}
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
        <ChatPanel
          messages={chat.messages}
          participants={participants}
          selfId={selfId}
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
