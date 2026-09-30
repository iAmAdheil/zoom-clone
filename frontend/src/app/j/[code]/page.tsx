import type { Metadata } from "next";
import { JoinForm } from "@/components/join/JoinForm";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";
import { queryText } from "@/lib/inviteLink";

export const metadata: Metadata = { title: "Join Meeting - Zoom clone" };

/** Invite link route: the join form with the meeting ID filled in. `?pwd=` fills the passcode. */
export default async function InviteLinkPage({ params, searchParams }: PageProps<"/j/[code]">) {
  const { code } = await params;
  const { pwd } = await searchParams;
  return (
    <SimpleShell
      headerRight={
        <ButtonLink href="/" variant="ghost" size="sm">
          Back to Home
        </ButtonLink>
      }
    >
      <div className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <JoinForm initialCode={code} initialPasscode={queryText(pwd)} />
      </div>
    </SimpleShell>
  );
}
