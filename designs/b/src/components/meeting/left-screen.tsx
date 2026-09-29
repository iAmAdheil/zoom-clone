import { PhoneOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Shown after the user leaves or ends the meeting. */
export function LeftScreen({ endedForAll, onRejoin }: { endedForAll: boolean; onRejoin: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-room px-4 text-center text-room-ink">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-room-3 text-danger">
        <PhoneOff className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        {endedForAll ? "You ended the meeting for everyone" : "You left the meeting"}
      </h1>
      <p className="max-w-sm text-sm text-room-ink-2">
        {endedForAll
          ? "The meeting is over. It now shows in your recent meetings."
          : "The meeting is still going. You can join again while it runs."}
      </p>
      <div className="mt-2 flex gap-3">
        {!endedForAll ? (
          <Button variant="room" onClick={onRejoin}>
            Rejoin
          </Button>
        ) : null}
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </main>
  );
}
