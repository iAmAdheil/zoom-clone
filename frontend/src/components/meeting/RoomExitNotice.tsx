import { Button, ButtonLink } from "@/components/ui/Button";
import type { RoomStatus } from "@/lib/useRoom";
import { MeetingNotice } from "./MeetingNotice";

type RoomExitNoticeProps = {
  status: Exclude<RoomStatus, "connecting" | "live" | "reconnecting">;
  title: string;
  /** A guest has no dashboard, so a guest goes to /join. */
  isGuest: boolean;
  onRetry: () => void;
};

/** The page that replaces the room when the server closes it: removed, ended, lost. */
export function RoomExitNotice({ status, title, isGuest, onRetry }: RoomExitNoticeProps) {
  const homeLink = (variant: "primary" | "secondary" = "primary") =>
    isGuest ? (
      <ButtonLink href="/join" variant={variant}>
        Join another meeting
      </ButtonLink>
    ) : (
      <ButtonLink href="/" variant={variant}>
        Back to Home
      </ButtonLink>
    );

  switch (status) {
    case "removed":
      return (
        <MeetingNotice
          icon="alert"
          title="You were removed from this meeting"
          detail={`The host removed you from "${title}". You cannot join this meeting again.`}
        >
          {homeLink()}
        </MeetingNotice>
      );
    case "ended":
      return (
        <MeetingNotice icon="clock" title="Meeting ended" detail={`The host ended "${title}".`}>
          {homeLink()}
        </MeetingNotice>
      );
    case "left":
      return (
        <MeetingNotice icon="video" title="You left the meeting" detail="You left this meeting in another window.">
          {homeLink()}
        </MeetingNotice>
      );
    case "failed":
      return (
        <MeetingNotice
          icon="alert"
          title="Connection lost"
          detail="The app could not connect to the meeting. Check your connection, then try again."
        >
          <Button onClick={onRetry}>Try again</Button>
          {homeLink("secondary")}
        </MeetingNotice>
      );
  }
}
