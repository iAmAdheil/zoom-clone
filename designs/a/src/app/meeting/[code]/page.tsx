import type { Metadata } from "next";
import { MeetingExperience, type Stage } from "@/components/meeting/MeetingExperience";
import type { Panel } from "@/components/meeting/ControlBar";
import { demoUser, meetingForCode } from "@/lib/mock";

export const metadata: Metadata = { title: "Meeting - Zoom clone" };

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/**
 * Query parameters (for demos and screenshots):
 * - name: display name from the join form
 * - stage=room: skip the preview
 * - panel=participants|chat: open a side panel
 */
export default async function MeetingPage({ params, searchParams }: PageProps<"/meeting/[code]">) {
  const { code } = await params;
  const query = await searchParams;

  const meeting = meetingForCode(code);
  const name = typeof query.name === "string" && query.name.trim() ? query.name : demoUser.name;
  const stage: Stage = pick(query.stage, ["room"] as const) ?? "preview";
  const panel: Panel = pick(query.panel, ["participants", "chat"] as const) ?? null;

  return (
    <MeetingExperience
      key={`${code}-${stage}`}
      meeting={meeting}
      initialName={name}
      initialStage={stage}
      initialPanel={panel}
    />
  );
}
