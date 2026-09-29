import type { Metadata } from "next";
import { JoinForm } from "@/components/join/JoinForm";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";
import { demoUser } from "@/lib/mock";

export const metadata: Metadata = { title: "Join Meeting - Zoom clone" };

export default function JoinPage() {
  return (
    <SimpleShell
      headerRight={
        <ButtonLink href="/" variant="ghost" size="sm">
          Back to Home
        </ButtonLink>
      }
    >
      <div className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <JoinForm defaultName={demoUser.name} />
      </div>
    </SimpleShell>
  );
}
