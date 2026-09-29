"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Participant } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { SidePanel } from "./SidePanel";

type ParticipantsPanelProps = {
  participants: Participant[];
  selfId: number;
  isHost: boolean;
  inviteLink: string;
  onClose: () => void;
  onToggleMute: (id: number) => void;
  onRemove: (p: Participant) => void;
  onMuteAll: () => void;
};

function roleLabel(p: Participant, isSelf: boolean) {
  const tags: string[] = [];
  if (p.role === "host") tags.push("Host");
  if (p.role === "co_host") tags.push("Co-host");
  if (p.user_id === null) tags.push("Guest");
  if (isSelf) tags.push("me");
  return tags.length ? `(${tags.join(", ")})` : "";
}

export function ParticipantsPanel(props: ParticipantsPanelProps) {
  const { participants, selfId, isHost } = props;
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const visible = participants.filter((p) =>
    p.display_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={props.onClose}
      footer={
        <div className="flex items-center gap-2">
          <Popover
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            label="Invite people"
            align="start"
            trigger={
              <Button
                variant="dark"
                size="sm"
                icon="userPlus"
                onClick={() => setInviteOpen((v) => !v)}
                aria-expanded={inviteOpen}
              >
                Invite
              </Button>
            }
          >
            <div className="grid w-72 gap-3 p-4">
              <p className="text-sm font-semibold">Invite people</p>
              <code className="truncate rounded-sm bg-room-raised px-2 py-1.5 text-xs text-room-ink-muted">
                {props.inviteLink}
              </code>
              <CopyButton text={props.inviteLink} label="Copy invite link" variant="primary" />
            </div>
          </Popover>
          {isHost && (
            <Button variant="dark" size="sm" icon="micOff" onClick={props.onMuteAll} className="ml-auto">
              Mute all
            </Button>
          )}
        </div>
      }
    >
      <div className="p-3">
        <label htmlFor="participant-search" className="sr-only">
          Find a participant
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-room-ink-faint"
          />
          <input
            id="participant-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a participant"
            className="h-9 w-full rounded-md border border-room-line bg-room-raised pr-3 pl-9 text-sm text-room-ink placeholder:text-room-ink-faint focus:border-focus-dark focus:outline-none"
          />
        </div>
      </div>

      <p className="px-4 pb-1 text-xs font-semibold text-room-ink-faint">In the meeting</p>
      <ul className="pb-2">
        {visible.map((p) => {
          const isSelf = p.id === selfId;
          const canControl = isHost && !isSelf;
          return (
            <li
              key={p.id}
              className="group flex h-12 items-center gap-3 px-4 transition-colors hover:bg-room-raised focus-within:bg-room-raised"
            >
              <Avatar name={p.display_name} seed={p.id} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm text-room-ink">
                {p.display_name} <span className="text-room-ink-muted">{roleLabel(p, isSelf)}</span>
              </p>

              {/* Host controls show on hover or focus, like Zoom. They stay visible on touch screens. */}
              {canControl && (
                <div
                  className={cn(
                    "flex items-center gap-1 md:hidden md:group-focus-within:flex md:group-hover:flex",
                    menuFor === p.id && "md:flex",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => props.onToggleMute(p.id)}
                    className="h-7 rounded-sm bg-room-hover px-2.5 text-xs font-medium text-room-ink transition-colors hover:bg-room-line"
                  >
                    {p.is_muted ? "Ask to unmute" : "Mute"}
                  </button>
                  <Popover
                    open={menuFor === p.id}
                    onClose={() => setMenuFor(null)}
                    label={`More for ${p.display_name}`}
                    placement="bottom"
                    align="end"
                    trigger={
                      <button
                        type="button"
                        aria-label={`More actions for ${p.display_name}`}
                        aria-expanded={menuFor === p.id}
                        onClick={() => setMenuFor((cur) => (cur === p.id ? null : p.id))}
                        className="flex size-7 items-center justify-center rounded-sm bg-room-hover text-room-ink transition-colors hover:bg-room-line"
                      >
                        <Icon name="more" size={16} />
                      </button>
                    }
                  >
                    <div className="grid w-48 gap-0.5 p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuFor(null);
                          props.onRemove(p);
                        }}
                        className="flex h-9 items-center gap-2 rounded-sm px-2.5 text-left text-sm text-danger transition-colors hover:bg-room-hover"
                      >
                        <Icon name="userMinus" size={16} />
                        Remove
                      </button>
                    </div>
                  </Popover>
                </div>
              )}

              <span
                className={cn(
                  "flex items-center gap-2",
                  canControl && "md:group-hover:hidden md:group-focus-within:hidden",
                  menuFor === p.id && "md:hidden",
                )}
              >
                <Icon
                  name={p.is_muted ? "micOff" : "mic"}
                  size={17}
                  className={p.is_muted ? "text-danger" : "text-room-ink-muted"}
                />
                <Icon
                  name={p.is_video_off ? "videoOff" : "video"}
                  size={17}
                  className={p.is_video_off ? "text-danger" : "text-room-ink-muted"}
                />
                <span className="sr-only">
                  {p.is_muted ? "Muted" : "Unmuted"}, {p.is_video_off ? "video off" : "video on"}
                </span>
              </span>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-room-ink-muted">No one matches “{query}”.</li>
        )}
      </ul>
    </SidePanel>
  );
}
