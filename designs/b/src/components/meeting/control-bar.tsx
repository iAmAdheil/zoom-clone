"use client";

import { useState } from "react";
import {
  Captions,
  Circle,
  Hand,
  Info,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  SmilePlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { cn } from "@/lib/format";
import { CaretButton, ControlButton } from "./control-button";
import { RoomMenuItem, RoomPopover } from "./room-popover";

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

export type Panel = "participants" | "chat" | null;

type ControlBarProps = {
  muted: boolean;
  videoOff: boolean;
  handRaised: boolean;
  sharing: boolean;
  isHost: boolean;
  participantCount: number;
  panel: Panel;
  unreadChat: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onTogglePanel: (panel: Exclude<Panel, null>) => void;
  onToggleShare: () => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onShowInfo: () => void;
  onLeave: (endForAll: boolean) => void;
};

type Menu = "reactions" | "more" | "leave" | null;

export function ControlBar(props: ControlBarProps) {
  const [menu, setMenu] = useState<Menu>(null);
  const close = () => setMenu(null);
  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));

  const {
    muted,
    videoOff,
    handRaised,
    sharing,
    isHost,
    participantCount,
    panel,
    unreadChat,
  } = props;

  return (
    <footer className="flex h-controlbar shrink-0 items-center gap-1 border-t border-room-line bg-room-2 px-1 sm:px-3">
      {/* Left: audio and video */}
      <div className="flex items-center">
        <ControlButton
          icon={muted ? <MicOff className="size-6 text-danger" /> : <Mic className="size-6" />}
          label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          aria-keyshortcuts="Alt+A"
          title={`${muted ? "Unmute" : "Mute"} (Alt+A)`}
          onClick={props.onToggleMic}
        />
        <CaretButton label="Audio settings" />
        <ControlButton
          icon={videoOff ? <VideoOff className="size-6 text-danger" /> : <Video className="size-6" />}
          label={videoOff ? "Start video" : "Stop video"}
          aria-pressed={videoOff}
          aria-keyshortcuts="Alt+V"
          title={`${videoOff ? "Start" : "Stop"} video (Alt+V)`}
          onClick={props.onToggleVideo}
        />
        <CaretButton label="Video settings" />
      </div>

      {/* Center: meeting tools */}
      <div className="mx-auto flex items-center gap-0.5 sm:gap-1">
        <ControlButton
          icon={<Users className="size-6" />}
          label="Participants"
          count={participantCount}
          active={panel === "participants"}
          aria-pressed={panel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
          className="max-sm:[&>span:last-child]:sr-only"
        />
        <div className="hidden sm:block">
          <ControlButton
            icon={<MessageSquare className="size-6" />}
            label="Chat"
            dot={unreadChat}
            active={panel === "chat"}
            aria-pressed={panel === "chat"}
            onClick={() => props.onTogglePanel("chat")}
          />
        </div>
        <ControlButton
          icon={
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-white",
                sharing ? "bg-danger" : "bg-share",
              )}
            >
              <MonitorUp className="size-4.5" />
            </span>
          }
          label={sharing ? "Stop share" : "Share"}
          aria-pressed={sharing}
          onClick={props.onToggleShare}
          className="max-sm:[&>span:last-child]:sr-only"
        />
        <div className="hidden sm:block">
        <RoomPopover
          open={menu === "reactions"}
          onClose={close}
          label="Reactions"
          trigger={
            <ControlButton
              icon={<SmilePlus className="size-6" />}
              label="Reactions"
              active={menu === "reactions"}
              aria-expanded={menu === "reactions"}
              onClick={() => toggle("reactions")}
            />
          }
        >
          <ReactionsMenu
            handRaised={handRaised}
            onReact={(e) => {
              props.onReact(e);
              close();
            }}
            onToggleHand={() => {
              props.onToggleHand();
              close();
            }}
          />
        </RoomPopover>
        </div>
        <RoomPopover
          open={menu === "more"}
          onClose={close}
          label="More options"
          align="end"
          className="w-56"
          trigger={
            <ControlButton
              icon={<MoreHorizontal className="size-6" />}
              label="More"
              active={menu === "more"}
              aria-expanded={menu === "more"}
              onClick={() => toggle("more")}
              className="max-sm:[&>span:last-child]:sr-only"
            />
          }
        >
          <div className="sm:hidden">
            <RoomMenuItem
              icon={<MessageSquare className="size-4" />}
              onClick={() => {
                props.onTogglePanel("chat");
                close();
              }}
            >
              Chat
            </RoomMenuItem>
            <p className="px-3 pt-2 pb-1 text-xs text-room-ink-3">Reactions</p>
            <ReactionsMenu
              handRaised={handRaised}
              onReact={(e) => {
                props.onReact(e);
                close();
              }}
              onToggleHand={() => {
                props.onToggleHand();
                close();
              }}
            />
            <div className="my-1 h-px bg-room-line" />
          </div>
          <RoomMenuItem
            icon={<Info className="size-4" />}
            onClick={() => {
              props.onShowInfo();
              close();
            }}
          >
            Meeting info
          </RoomMenuItem>
          <RoomMenuItem icon={<Circle className="size-4" />}>Record (placeholder)</RoomMenuItem>
          <RoomMenuItem icon={<Captions className="size-4" />}>Captions (placeholder)</RoomMenuItem>
        </RoomPopover>
      </div>

      {/* Right: leave or end */}
      <RoomPopover
        open={menu === "leave"}
        onClose={close}
        label="Leave meeting"
        align="end"
        className="w-64 p-3"
        trigger={
          <button
            type="button"
            aria-expanded={menu === "leave"}
            onClick={() => toggle("leave")}
            className="focus-ring-room flex h-9 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-semibold text-white transition-colors hover:bg-danger-hover sm:px-4"
          >
            <PhoneOff className="size-4 sm:hidden" />
            <span className="max-sm:sr-only">{isHost ? "End" : "Leave"}</span>
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {isHost ? (
            <>
              <p className="px-1 pb-1 text-xs text-room-ink-2">
                You are the host. Ending the meeting removes everyone.
              </p>
              <button
                type="button"
                onClick={() => props.onLeave(true)}
                className="focus-ring-room h-10 rounded-lg bg-danger text-sm font-semibold text-white hover:bg-danger-hover"
              >
                End meeting for all
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => props.onLeave(false)}
            className="focus-ring-room flex h-10 items-center justify-center gap-2 rounded-lg bg-room-2 text-sm font-semibold text-room-ink hover:bg-room-hover"
          >
            <LogOut className="size-4" />
            Leave meeting
          </button>
        </div>
      </RoomPopover>
    </footer>
  );
}

function ReactionsMenu({
  handRaised,
  onReact,
  onToggleHand,
}: {
  handRaised: boolean;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={() => onReact(emoji)}
            className="focus-ring-room flex size-10 items-center justify-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-room-hover"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleHand}
        aria-pressed={handRaised}
        className={cn(
          "focus-ring-room flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
          handRaised ? "bg-warning text-black hover:opacity-90" : "bg-room-2 text-room-ink hover:bg-room-hover",
        )}
      >
        <Hand className="size-4" />
        {handRaised ? "Lower hand" : "Raise hand"}
      </button>
    </div>
  );
}
