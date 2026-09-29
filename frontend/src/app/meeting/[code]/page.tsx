import type { Metadata } from "next";
import { MeetingExperience } from "@/components/meeting/MeetingExperience";

export const metadata: Metadata = { title: "Meeting - Zoom clone" };

/** Pre-join preview, then the room. Guests can open it, so it needs no sign in. */
export default async function MeetingPage({ params }: PageProps<"/meeting/[code]">) {
  const { code } = await params;
  const digits = code.replace(/\D/g, "");
  return <MeetingExperience key={digits} code={digits} />;
}
