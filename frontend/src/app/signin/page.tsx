import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";
import { safeNext } from "@/lib/redirects";

export const metadata: Metadata = { title: "Sign in" };

/** `?next=/path` brings the user back to that page after sign in. */
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { next } = await searchParams;

  return (
    <SimpleShell
      headerRight={
        <ButtonLink href="/join" variant="secondary" size="sm">
          Join a meeting
        </ButtonLink>
      }
    >
      <div className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
        <SignInForm next={safeNext(next)} />
      </div>
    </SimpleShell>
  );
}
