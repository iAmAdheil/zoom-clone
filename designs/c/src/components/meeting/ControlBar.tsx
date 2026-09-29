"use client";

import { useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CaretButton, ControlButton } from "./ControlButton";
import { DeviceMenu, LeaveMenu, ReactionsMenu, cameraGroups, micGroups } from "./RoomMenus";

export type PanelName = "participants" | "chat";
type Menu = "mic" | "camera" | "reactions" | "leave" | "more" | null;

type ControlBarProps = {
  muted: boolean;
  videoOff: boolean;
  sharing: boolean;
  handRaised: boolean;
  panel: PanelName | null;
  participantCount: number;
  unreadChat: number;
  isHost: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: PanelName) => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onEndForAll: () => void;
  onLeave: () => void;
};

/**
 * Bottom toolbar. Layout follows the Zoom client:
 * audio and video on the left, meeting tools in the middle, End on the right.
 * On phones, Share and Reactions move into "More" and End moves to the top bar.
 */
export function ControlBar(props: ControlBarProps) {
  const [menu, setMenu] = useState<Menu>(null);
  const close = () => setMenu(null);
  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));

  return (
    <div
      role="toolbar"
      aria-label="Meeting controls"
      className="flex h-roombar shrink-0 items-center justify-between gap-1 bg-room-bar px-2 sm:px-4"
    >
      {/* Left: audio and video */}
      <div className="flex items-center">
        <ControlButton
          icon={props.muted ? "micOff" : "mic"}
          label={props.muted ? "Unmute" : "Mute"}
          alert={props.muted}
          aria-pressed={props.muted}
          onClick={props.onToggleMute}
        />
        <Popover
          open={menu === "mic"}
          onClose={close}
          label="Audio devices"
          align="start"
          trigger={
            <CaretButton
              label="Audio settings"
              aria-expanded={menu === "mic"}
              onClick={() => toggle("mic")}
            />
          }
        >
          <DeviceMenu groups={micGroups} />
        </Popover>
        <ControlButton
          icon={props.videoOff ? "videoOff" : "video"}
          label={props.videoOff ? "Start Video" : "Stop Video"}
          alert={props.videoOff}
          aria-pressed={props.videoOff}
          onClick={props.onToggleVideo}
        />
        <Popover
          open={menu === "camera"}
          onClose={close}
          label="Video devices"
          align="start"
          trigger={
            <CaretButton
              label="Video settings"
              aria-expanded={menu === "camera"}
              onClick={() => toggle("camera")}
            />
          }
        >
          <DeviceMenu groups={cameraGroups} />
        </Popover>
      </div>

      {/* Middle: meeting tools */}
      <div className="flex items-center sm:gap-1">
        <ControlButton
          icon="users"
          label="Participants"
          count={props.participantCount}
          active={props.panel === "participants"}
          aria-expanded={props.panel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
        />
        <div className="relative">
          <ControlButton
            icon="chat"
            label="Chat"
            active={props.panel === "chat"}
            aria-expanded={props.panel === "chat"}
            onClick={() => props.onTogglePanel("chat")}
          />
          {props.unreadChat > 0 && props.panel !== "chat" && (
            <span className="pointer-events-none absolute top-1.5 right-3 size-2.5 rounded-full bg-danger ring-2 ring-room-bar sm:right-4">
              <span className="sr-only">{props.unreadChat} unread messages</span>
            </span>
          )}
        </div>
        <ControlButton
          icon="share"
          label={props.sharing ? "Stop Share" : "Share"}
          highlight
          active={props.sharing}
          aria-pressed={props.sharing}
          onClick={props.onToggleShare}
          className="hidden sm:flex"
        />
        <div className="hidden sm:block">
          <Popover
            open={menu === "reactions"}
            onClose={close}
            label="Reactions"
            trigger={
              <ControlButton
                icon="heart"
                label="Reactions"
                active={menu === "reactions"}
                aria-expanded={menu === "reactions"}
                onClick={() => toggle("reactions")}
              />
            }
          >
            <ReactionsMenu
              handRaised={props.handRaised}
              onToggleHand={props.onToggleHand}
              onReact={(e) => {
                props.onReact(e);
                close();
              }}
            />
          </Popover>
        </div>
        <Popover
          open={menu === "more"}
          onClose={close}
          label="More options"
          align="end"
          trigger={
            <ControlButton
              icon="more"
              label="More"
              active={menu === "more"}
              aria-expanded={menu === "more"}
              onClick={() => toggle("more")}
            />
          }
        >
          <div className="grid w-72 gap-1 p-2">
            <div className="sm:hidden">
              <ReactionsMenu
                handRaised={props.handRaised}
                onToggleHand={props.onToggleHand}
                onReact={(e) => {
                  props.onReact(e);
                  close();
                }}
              />
              <div className="my-1 border-t border-room-line" />
              <MoreItem
                icon="share"
                label={props.sharing ? "Stop sharing" : "Share screen"}
                onClick={() => {
                  props.onToggleShare();
                  close();
                }}
              />
            </div>
            <MoreItem icon="record" label="Record" disabled />
            <MoreItem icon="grid" label="Gallery view" disabled />
            <MoreItem icon="settings" label="Settings" disabled />
          </div>
        </Popover>
      </div>

      {/* Right: End */}
      <div className="hidden sm:block">
        <Popover
          open={menu === "leave"}
          onClose={close}
          label="Leave meeting"
          align="end"
          trigger={
            <button
              type="button"
              aria-expanded={menu === "leave"}
              onClick={() => toggle("leave")}
              className="h-9 rounded-md bg-danger px-4 text-sm font-semibold text-white transition-colors hover:bg-danger-hover"
            >
              End
            </button>
          }
        >
          <LeaveMenu isHost={props.isHost} onEndForAll={props.onEndForAll} onLeave={props.onLeave} />
        </Popover>
      </div>
    </div>
  );
}

function MoreItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-full items-center gap-3 rounded-sm px-2.5 text-left text-sm text-room-ink transition-colors hover:bg-room-hover disabled:cursor-not-allowed disabled:text-room-ink-faint disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={18} />
      {label}
      {disabled && <span className="ml-auto text-2xs">Not in mockup</span>}
    </button>
  );
}
