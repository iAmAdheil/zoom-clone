import type { Metadata } from "next";
import { JoinForm } from "@/components/join/JoinForm";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Join Meeting - Zoom clone" };

/** Invite link route: the join form with the meeting ID filled in. */
export default async function InviteLinkPage({ params }: PageProps<"/j/[code]">) {
  const { code } = await params;
  return (
    <SimpleShell
      headerRight={
        <ButtonLink href="/" variant="ghost" size="sm">
          Back to Home
        </ButtonLink>
      }
    >
      <div className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <JoinForm initialCode={code} />
      </div>
    </SimpleShell>
  );
}
