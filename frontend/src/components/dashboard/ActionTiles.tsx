"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/hooks";
import { useStartInstantMeeting } from "@/lib/useStartMeeting";

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
  const newMeeting = useStartInstantMeeting();
  const toast = useToast(4000);

  async function startNewMeeting() {
    const error = await newMeeting.start();
    if (error) toast.show(error);
  }

  return (
    <>
      <div className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-7 sm:gap-x-10">
        <button
          type="button"
          className={cn(wrapClass, "disabled:cursor-wait disabled:opacity-70")}
          onClick={startNewMeeting}
          disabled={newMeeting.pending}
          aria-busy={newMeeting.pending}
        >
          <TileFace icon="video" tone="accent" label={newMeeting.pending ? "Starting..." : "New Meeting"} />
        </button>
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
        <Field id="share-key" label="Sharing key or meeting ID" hint="Screen sharing is not available yet.">
          <TextInput
            id="share-key"
            value={shareKey}
            onChange={(e) => setShareKey(e.target.value)}
            placeholder="Enter sharing key or meeting ID"
            aria-describedby="share-key-msg"
          />
        </Field>
      </Modal>
      <Toast message={toast.message} tone="error" />
    </>
  );
}
