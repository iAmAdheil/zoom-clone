import type { Metadata } from "next";
import { MeetingExperience } from "@/components/meeting/MeetingExperience";
import { backendUrl } from "@/lib/backendUrl";

/** The tab title is the meeting title. The lookup is public (docs/api.md), so a guest gets it too. */
export async function generateMetadata({ params }: PageProps<"/meeting/[code]">): Promise<Metadata> {
  const { code } = await params;
  const digits = code.replace(/\D/g, "");
  try {
    const response = await fetch(`${backendUrl}/api/meetings/${digits}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const meeting: { title?: string } = await response.json();
      if (meeting.title) return { title: meeting.title };
    }
  } catch {
    // The backend is slow or down. The page shows its own error. Use the plain title.
  }
  return { title: "Meeting" };
}

/** Pre-join preview, then the room. Guests can open it, so it needs no sign in. */
export default async function MeetingPage({ params }: PageProps<"/meeting/[code]">) {
  const { code } = await params;
  const digits = code.replace(/\D/g, "");
  return <MeetingExperience key={digits} code={digits} />;
}
