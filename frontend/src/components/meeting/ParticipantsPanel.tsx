"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import type { Meeting, Participant } from "@/lib/types";
import { InviteLinkBox } from "./InviteLinkBox";
import { SidePanel } from "./SidePanel";

type ParticipantsPanelProps = {
  meeting: Meeting;
  participants: Participant[];
  selfId: number;
  isHost: boolean;
  allowSelfUnmute: boolean;
  onClose: () => void;
  onMute: (id: number) => void;
  onAskUnmute: (id: number) => void;
  onRemove: (id: number) => void;
  onMuteAll: () => void;
  onToggleSelfUnmute: () => void;
  onNotify: (message: string) => void;
};

function roleLabel(p: Participant, isSelf: boolean) {
  const parts: string[] = [];
  if (p.role === "host") parts.push("Host");
  if (p.role === "co_host") parts.push("Co-host");
  if (isSelf) parts.push("me");
  if (p.user_id === null) parts.push("Guest");
  return parts.length ? `(${parts.join(", ")})` : "";
}

const rowAction =
  "h-7 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-bold text-ink transition-colors hover:bg-surface-hover";

export function ParticipantsPanel(props: ParticipantsPanelProps) {
  const { meeting, participants, selfId, isHost, allowSelfUnmute, onClose, onNotify } = props;
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Host first, then me, then everyone else in join order (Zoom sorts the same way).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (p: Participant) => (p.role === "host" ? 0 : p.id === selfId ? 1 : p.role === "co_host" ? 2 : 3);
    return participants
      .filter((p) => p.display_name.toLowerCase().includes(q))
      .toSorted((a, b) => rank(a) - rank(b));
  }, [participants, query, selfId]);

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Popover
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            label="Invite"
            placement="top-start"
            panelClassName="w-72 p-4"
            trigger={
              <Button variant="secondary" size="sm" aria-expanded={inviteOpen} onClick={() => setInviteOpen((v) => !v)}>
                Invite
              </Button>
            }
          >
            <p className="mb-2 text-sm font-bold">Invite people</p>
            <InviteLinkBox
              meeting={meeting}
              tone="light"
              onCopied={(m) => {
                setInviteOpen(false);
                onNotify(m);
              }}
            />
          </Popover>
          {isHost ? (
            <Button variant="secondary" size="sm" onClick={props.onMuteAll}>
              Mute All
            </Button>
          ) : null}
          <Popover
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            label="More participant options"
            placement="top-end"
            panelClassName="w-64 p-1.5"
            trigger={
              <Button variant="secondary" size="sm" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
                More <Icon name="chevronDown" size={14} />
              </Button>
            }
          >
            <MenuItem
              onSelect={() => {
                props.onToggleSelfUnmute();
                setMoreOpen(false);
              }}
            >
              <Icon name="check" size={16} className={cn(!allowSelfUnmute && "invisible")} />
              Allow participants to unmute themselves
            </MenuItem>
            <MenuItem onSelect={() => setMoreOpen(false)}>
              <span className="w-4" /> Lock meeting (not available yet)
            </MenuItem>
          </Popover>
        </div>
      }
    >
      <div className="p-3">
        <label className="relative block">
          <span className="sr-only">Search participants</span>
          <Icon name="search" size={16} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-full rounded-md border border-line bg-surface-muted pr-2 pl-8 text-sm placeholder:text-ink-subtle focus:border-primary focus:bg-surface focus:outline-none"
          />
        </label>
      </div>

      <p className="px-4 pb-1 text-xs font-bold text-ink-muted">In the meeting ({participants.length})</p>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-muted">No participants match “{query}”.</p>
      ) : (
        <ul className="pb-2">
          {visible.map((p) => {
            const isSelf = p.id === selfId;
            const canControl = isHost && !isSelf;
            return (
              <li
                key={p.id}
                className="group flex min-h-12 items-center gap-2.5 px-4 py-1.5 transition-colors hover:bg-surface-hover focus-within:bg-surface-hover"
              >
                <Avatar name={p.display_name} size="sm" shape="square" />
                <p className="min-w-0 flex-1 truncate text-sm">
                  {p.display_name} <span className="text-ink-muted">{roleLabel(p, isSelf)}</span>
                </p>

                {canControl ? (
                  // Host actions show on hover or focus. Touch screens always show them.
                  <div className="hidden gap-1.5 group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
                    {p.is_muted ? (
                      <button type="button" className={rowAction} onClick={() => props.onAskUnmute(p.id)}>
                        Ask to Unmute
                      </button>
                    ) : (
                      <button type="button" className={rowAction} onClick={() => props.onMute(p.id)}>
                        Mute
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn(rowAction, "text-danger")}
                      onClick={() => props.onRemove(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    canControl && "group-focus-within:hidden group-hover:hidden [@media(hover:none)]:hidden",
                  )}
                >
                  <Icon
                    name={p.is_muted ? "micOff" : "mic"}
                    size={18}
                    className={p.is_muted ? "text-danger" : "text-ink-muted"}
                    aria-label={p.is_muted ? "Muted" : "Unmuted"}
                  />
                  <Icon
                    name={p.is_video_off ? "videoOff" : "video"}
                    size={18}
                    className={p.is_video_off ? "text-danger" : "text-ink-muted"}
                    aria-label={p.is_video_off ? "Video off" : "Video on"}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SidePanel>
  );
}
