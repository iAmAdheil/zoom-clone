import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Sign in - Zoom clone" };

export default function SignInPage() {
  return (
    <SimpleShell
      headerRight={
        <ButtonLink href="/join" variant="secondary" size="sm">
          Join a meeting
        </ButtonLink>
      }
    >
      <div className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
        <SignInForm />
      </div>
    </SimpleShell>
  );
}
