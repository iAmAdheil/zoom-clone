import type { Metadata } from "next";
import { MeetingExperience } from "@/components/meeting/MeetingExperience";
import { inviteLink } from "@/lib/format";
import { liveMeeting } from "@/lib/mock";

export const metadata: Metadata = { title: "Meeting" };

/**
 * Query options for review and screenshots:
 *   ?stage=room                 skip the preview
 *   ?stage=room&panel=chat      open a side panel (participants or chat)
 */
export default async function MeetingPage({ params, searchParams }: PageProps<"/meeting/[code]">) {
  const { code } = await params;
  const { stage, panel } = await searchParams;

  // Every code shows the mock live meeting, with the requested ID.
  const meeting = { ...liveMeeting, meeting_code: code, invite_link: inviteLink(code) };

  return (
    <MeetingExperience
      meeting={meeting}
      initialStage={stage === "room" ? "room" : "prejoin"}
      initialPanel={panel === "participants" || panel === "chat" ? panel : null}
    />
  );
}
