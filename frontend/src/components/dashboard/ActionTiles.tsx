"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { instantMeeting } from "@/lib/mock";

const tileClass =
  "flex size-tile-btn items-center justify-center rounded-tile text-white shadow-tile transition-[background-color,transform] group-hover:-translate-y-0.5 group-active:translate-y-0";

const wrapClass =
  "group flex w-tile-btn flex-col items-center gap-2 rounded-tile text-sm font-bold text-ink-2";

function TileFace({ icon, tone, label }: { icon: IconName; tone: "accent" | "primary"; label: string }) {
  return (
    <>
      <span
        className={cn(
          tileClass,
          tone === "accent" ? "bg-accent group-hover:bg-accent-hover" : "bg-primary group-hover:bg-primary-hover",
        )}
      >
        <Icon name={icon} size={36} strokeWidth={1.6} />
      </span>
      <span>{label}</span>
    </>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={wrapClass}>
      {children}
    </Link>
  );
}

/** The four big Zoom Home buttons: New Meeting (orange), Join, Schedule, Share Screen. */
export function ActionTiles() {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareKey, setShareKey] = useState("");

  return (
    <>
      <div className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-7 sm:gap-x-10">
        <TileLink href={`/meeting/${instantMeeting.meeting_code}`}>
          <TileFace icon="video" tone="accent" label="New Meeting" />
        </TileLink>
        <TileLink href="/join">
          <TileFace icon="plus" tone="primary" label="Join" />
        </TileLink>
        <TileLink href="/schedule">
          <TileFace icon="calendar" tone="primary" label="Schedule" />
        </TileLink>
        <button type="button" className={wrapClass} onClick={() => setShareOpen(true)}>
          <TileFace icon="share" tone="primary" label="Share Screen" />
        </button>
      </div>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share Screen"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={shareKey.trim().length < 6} onClick={() => setShareOpen(false)}>
              Share
            </Button>
          </>
        }
      >
        <Field id="share-key" label="Sharing key or meeting ID" hint="Screen sharing is not part of this mockup.">
          <TextInput
            id="share-key"
            value={shareKey}
            onChange={(e) => setShareKey(e.target.value)}
            placeholder="Enter sharing key or meeting ID"
            aria-describedby="share-key-msg"
          />
        </Field>
      </Modal>
    </>
  );
}
