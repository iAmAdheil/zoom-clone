"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { unreadBadge } from "@/lib/chat";
import { ControlButton } from "./ControlButton";
import { SplitControl, type MenuAction, type MenuGroup } from "./SplitControl";

const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

export type Panel = "participants" | "chat" | null;

export type DeviceMenu = { groups: MenuGroup[]; actions: MenuAction[] };

type ControlBarProps = {
  micOn: boolean;
  camOn: boolean;
  /** False when the page has no microphone track (not allowed, or no device). */
  micAvailable: boolean;
  camAvailable: boolean;
  audioMenu: DeviceMenu;
  videoMenu: DeviceMenu;
  /** False when the browser cannot list the devices. Then the carets hide. */
  showDeviceMenus: boolean;
  panel: Panel;
  participantCount: number;
  /** A side panel takes width, so Reactions and Share Screen move into More below 1024px. */
  panelOpen: boolean;
  unreadChat: number;
  isHost: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onTogglePanel: (panel: Exclude<Panel, null>) => void;
  onReact: (emoji: string) => void;
  onShare: () => void;
  onCopyInvite: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
};

type Menu = "audio" | "video" | "reactions" | "more" | "leave" | null;

/** Bottom toolbar of the Zoom meeting window. */
export function ControlBar(props: ControlBarProps) {
  const { micOn, camOn, panel, participantCount, unreadChat, isHost, panelOpen } = props;
  // Tailwind needs full class names in the source, so each case is written out.
  const reactionsShown = panelOpen ? "hidden lg:block" : "hidden sm:block";
  const reactionsInMore = panelOpen ? "lg:hidden" : "sm:hidden";
  const shareShown = panelOpen ? "hidden lg:flex" : "hidden md:flex";
  const shareInMore = panelOpen ? "lg:hidden" : "md:hidden";
  const [menu, setMenu] = useState<Menu>(null);
  const close = () => setMenu(null);
  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));

  const reactionRow = (
    <div className="flex gap-0.5 p-1">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React with ${emoji}`}
          onClick={() => {
            props.onReact(emoji);
            close();
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-2xl transition-transform hover:scale-110 hover:bg-room-hover"
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div
      role="toolbar"
      aria-label="Meeting controls"
      className="flex h-toolbar shrink-0 items-center justify-between gap-1 bg-room-bar px-1 sm:px-3"
    >
      <div className="flex items-center">
        <SplitControl
          label="Audio options"
          open={menu === "audio"}
          onToggle={() => toggle("audio")}
          onClose={close}
          groups={props.audioMenu.groups}
          actions={props.audioMenu.actions}
          emptyText="No microphone was found."
          showCaret={props.showDeviceMenus}
        >
          <ControlButton
            grouped
            icon={micOn ? "mic" : "micOff"}
            label={micOn ? "Mute" : "Unmute"}
            alert={!micOn}
            badge={props.micAvailable ? undefined : "!"}
            title={props.micAvailable ? undefined : "Microphone not allowed. Click to allow it."}
            aria-label={props.micAvailable ? undefined : "Unmute. Microphone not allowed"}
            aria-pressed={!micOn}
            onClick={props.onToggleMic}
          />
        </SplitControl>
        <SplitControl
          label="Video options"
          open={menu === "video"}
          onToggle={() => toggle("video")}
          onClose={close}
          groups={props.videoMenu.groups}
          actions={props.videoMenu.actions}
          emptyText="No camera was found."
          showCaret={props.showDeviceMenus}
        >
          <ControlButton
            grouped
            icon={camOn ? "video" : "videoOff"}
            label={camOn ? "Stop Video" : "Start Video"}
            alert={!camOn}
            badge={props.camAvailable ? undefined : "!"}
            title={props.camAvailable ? undefined : "Camera not allowed. Click to allow it."}
            aria-label={props.camAvailable ? undefined : "Start Video. Camera not allowed"}
            aria-pressed={!camOn}
            onClick={props.onToggleCam}
          />
        </SplitControl>
      </div>

      <div className="flex items-center">
        <ControlButton
          icon="users"
          label="Participants"
          // The name starts with the word, then the count ("Participants, 3"). The badge is only for the eyes.
          aria-label={`Participants, ${participantCount}`}
          badge={participantCount}
          active={panel === "participants"}
          aria-pressed={panel === "participants"}
          badgeTone="count"
          onClick={() => props.onTogglePanel("participants")}
        />
        <ControlButton
          icon="chat"
          label="Chat"
          aria-label={unreadChat > 0 ? `Chat, ${unreadChat} unread` : "Chat"}
          badge={unreadBadge(unreadChat) ?? undefined}
          active={panel === "chat"}
          aria-pressed={panel === "chat"}
          onClick={() => props.onTogglePanel("chat")}
        />
        <Popover
          open={menu === "reactions"}
          onClose={close}
          label="Reactions"
          tone="dark"
          placement="top-center"
          className={reactionsShown}
          trigger={
            <ControlButton
              icon="heart"
              label="Reactions"
              aria-expanded={menu === "reactions"}
              onClick={() => toggle("reactions")}
            />
          }
        >
          {reactionRow}
        </Popover>
        <ControlButton
          icon="share"
          label="Share Screen"
          highlight
          onClick={props.onShare}
          className={shareShown}
        />
        <Popover
          open={menu === "more"}
          onClose={close}
          label="More"
          tone="dark"
          placement="top-end"
          panelClassName="w-[17.5rem] max-w-[calc(100vw-16px)] p-1.5"
          trigger={
            <ControlButton icon="more" label="More" aria-expanded={menu === "more"} onClick={() => toggle("more")} />
          }
        >
          <div className={reactionsInMore}>{reactionRow}</div>
          <MenuItem tone="dark" onSelect={() => { props.onCopyInvite(); close(); }}>
            <Icon name="link" size={16} /> Copy invite link
          </MenuItem>
          <div className={shareInMore}>
            <MenuItem tone="dark" onSelect={() => { props.onShare(); close(); }}>
              <Icon name="share" size={16} /> Share Screen
            </MenuItem>
          </div>
          <MenuItem tone="dark" onSelect={close}>
            <Icon name="record" size={16} /> Record (not available yet)
          </MenuItem>
          <MenuItem tone="dark" onSelect={close}>
            <Icon name="settings" size={16} /> Settings
          </MenuItem>
        </Popover>
      </div>

      <Popover
        open={menu === "leave"}
        onClose={close}
        label={isHost ? "End meeting" : "Leave meeting"}
        tone="dark"
        placement="top-end"
        panelClassName="w-64 p-3"
        trigger={
          <button
            type="button"
            aria-expanded={menu === "leave"}
            onClick={() => toggle("leave")}
            className="h-10 rounded-md bg-danger px-3 text-sm font-bold text-white transition-colors hover:bg-danger-hover sm:h-9 sm:px-4"
          >
            {isHost ? "End" : "Leave"}
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {isHost ? (
            <button
              type="button"
              onClick={() => { props.onEndForAll(); close(); }}
              className="h-10 rounded-md bg-danger text-sm font-bold text-white transition-colors hover:bg-danger-hover"
            >
              End Meeting for All
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { props.onLeave(); close(); }}
            className="h-10 rounded-md bg-room-hover text-sm font-bold text-room-text transition-colors hover:bg-room-press"
          >
            Leave Meeting
          </button>
          <button
            type="button"
            onClick={close}
            className="h-10 rounded-md text-sm text-room-muted transition-colors hover:text-room-text"
          >
            Cancel
          </button>
        </div>
      </Popover>
    </div>
  );
}
