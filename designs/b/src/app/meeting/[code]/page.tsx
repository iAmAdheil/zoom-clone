import type { Metadata } from "next";
import { MeetingExperience, type Stage } from "@/components/meeting/meeting-experience";
import type { Panel } from "@/components/meeting/control-bar";
import { findMeetingByCode, liveMeeting } from "@/lib/mock";

export const metadata: Metadata = { title: "Meeting · Zoom Workplace clone" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Query options (mock only, also used for screenshots):
 * - stage=room opens the room and skips the preview.
 * - panel=participants|chat opens a side panel.
 * - mic=off and cam=off set the start state (sent by the join form).
 */
export default async function MeetingPage(props: PageProps<"/meeting/[code]">) {
  const { code } = await props.params;
  const query = await props.searchParams;

  const found = findMeetingByCode(code);
  const meeting = found ? { ...found, status: "live" as const } : { ...liveMeeting, meeting_code: code.replace(/\D/g, "") };

  const stage: Stage = first(query.stage) === "room" ? "room" : "preview";
  const panelParam = first(query.panel);
  const panel: Panel = panelParam === "participants" || panelParam === "chat" ? panelParam : null;

  return (
    <MeetingExperience
      meeting={meeting}
      initialStage={stage}
      initialMicOn={first(query.mic) !== "off"}
      initialCamOn={first(query.cam) !== "off"}
      initialPanel={panel}
    />
  );
}
