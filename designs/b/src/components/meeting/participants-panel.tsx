"use client";

import { useState } from "react";
import { Hand, Mic, MicOff, MoreHorizontal, Search, UserMinus, UserPlus, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/format";
import type { RoomParticipant } from "@/lib/types";
import { RoomMenuItem, RoomPopover } from "./room-popover";
import { roleLabel, sortForPanel } from "./room-state";
import { SidePanel } from "./side-panel";

type ParticipantsPanelProps = {
  participants: RoomParticipant[];
  canManage: boolean;
  onClose: () => void;
  onMute: (p: RoomParticipant) => void;
  onAskUnmute: (p: RoomParticipant) => void;
  onRemove: (p: RoomParticipant) => void;
  onMuteAll: () => void;
  onInvite: () => void;
};

export function ParticipantsPanel(props: ParticipantsPanelProps) {
  const { participants, canManage } = props;
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const list = sortForPanel(participants).filter((p) => p.display_name.toLowerCase().includes(q));

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={props.onClose}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onInvite}
            className="focus-ring-room flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-room-3 text-sm font-medium hover:bg-room-hover"
          >
            <UserPlus className="size-4" />
            Invite
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={props.onMuteAll}
              className="focus-ring-room flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-room-3 text-sm font-medium hover:bg-room-hover"
            >
              <MicOff className="size-4" />
              Mute all
            </button>
          ) : null}
        </div>
      }
    >
      <div className="p-3">
        <label className="relative block">
          <span className="sr-only">Find a participant</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-room-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a participant"
            className="h-9 w-full rounded-lg border border-room-line bg-room-3 pr-3 pl-9 text-sm text-room-ink placeholder:text-room-ink-3 focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      {canManage ? (
        <p className="px-4 pb-2 text-xs text-room-ink-3">You are the host. You can mute or remove people.</p>
      ) : null}

      <ul className="pb-3">
        {list.map((p) => (
          <ParticipantRow
            key={p.id}
            participant={p}
            canManage={canManage && !p.is_self}
            menuOpen={menuFor === p.id}
            onOpenMenu={() => setMenuFor((cur) => (cur === p.id ? null : p.id))}
            onCloseMenu={() => setMenuFor(null)}
            onMute={() => props.onMute(p)}
            onAskUnmute={() => props.onAskUnmute(p)}
            onRemove={() => {
              setMenuFor(null);
              props.onRemove(p);
            }}
          />
        ))}
        {list.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-room-ink-3">No one matches “{query}”.</li>
        ) : null}
      </ul>
    </SidePanel>
  );
}

type RowProps = {
  participant: RoomParticipant;
  canManage: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onMute: () => void;
  onAskUnmute: () => void;
  onRemove: () => void;
};

function ParticipantRow({ participant: p, canManage, menuOpen, ...actions }: RowProps) {
  const role = roleLabel(p);
  return (
    <li className="group relative flex items-center gap-3 px-4 py-2 hover:bg-room-hover focus-within:bg-room-hover">
      <Avatar name={p.display_name} tone={p.tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {p.display_name}
          {role ? <span className="ml-1 text-room-ink-3">({role})</span> : null}
        </p>
      </div>

      {/* Status icons. Hidden on hover when host actions show. */}
      <div
        className={cn(
          "flex items-center gap-2 text-room-ink-2",
          canManage && "max-md:hidden md:group-hover:hidden md:group-focus-within:hidden",
          canManage && menuOpen && "md:hidden",
        )}
      >
        {p.hand_raised ? <Hand className="size-4 text-warning" aria-label="Hand raised" /> : null}
        {p.is_muted ? (
          <MicOff className="size-4 text-danger" aria-label="Muted" />
        ) : (
          <Mic className="size-4" aria-label="Unmuted" />
        )}
        {p.is_video_off ? (
          <VideoOff className="size-4 text-danger" aria-label="Video off" />
        ) : (
          <Video className="size-4" aria-label="Video on" />
        )}
      </div>

      {canManage ? (
        <div
          className={cn(
            "flex items-center gap-1",
            !menuOpen && "md:hidden md:group-hover:flex md:group-focus-within:flex",
          )}
        >
          {p.hand_raised ? <Hand className="size-4 text-warning md:hidden" aria-hidden /> : null}
          <button
            type="button"
            onClick={p.is_muted ? actions.onAskUnmute : actions.onMute}
            className="focus-ring-room h-7 rounded-md bg-room-3 px-2.5 text-xs font-medium hover:bg-room-line"
          >
            {p.is_muted ? "Ask to unmute" : "Mute"}
          </button>
          <RoomPopover
            open={menuOpen}
            onClose={actions.onCloseMenu}
            label={`More options for ${p.display_name}`}
            align="end"
            side="bottom"
            className="w-48"
            trigger={
              <button
                type="button"
                aria-label={`More options for ${p.display_name}`}
                aria-expanded={menuOpen}
                onClick={actions.onOpenMenu}
                className="focus-ring-room flex size-7 items-center justify-center rounded-md bg-room-3 hover:bg-room-line"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          >
            <RoomMenuItem>Make co-host (placeholder)</RoomMenuItem>
            <RoomMenuItem>Rename (placeholder)</RoomMenuItem>
            <div className="my-1 h-px bg-room-line" />
            <RoomMenuItem tone="danger" icon={<UserMinus className="size-4 text-danger" />} onClick={actions.onRemove}>
              Remove
            </RoomMenuItem>
          </RoomPopover>
        </div>
      ) : null}
    </li>
  );
}
