import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { JoinForm } from "./JoinForm";

/** Shared body for /join and /j/{code}. */
export function JoinPage({ initialCode }: { initialCode?: string }) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-4 py-8 md:py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Join a meeting</h1>
        <p className="mt-1 text-sm text-ink-muted">Paste the meeting ID or the invite link.</p>
        <Card className="mt-6 p-5 md:p-6">
          <JoinForm initialCode={initialCode} />
        </Card>
      </div>
    </AppShell>
  );
}
