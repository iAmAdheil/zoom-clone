import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ApiError } from "@/lib/api";
import { signInHref } from "@/lib/redirects";

export type JoinErrorView = {
  /** Where the form shows the message. */
  field: "code" | "passcode" | "form";
  message: string;
  /** True when signing in fixes the problem (a verified_only meeting). */
  needsSignIn: boolean;
};

/** Turns a join error (docs/api.md codes) into a message for the join form or the preview. */
export function describeJoinError(error: ApiError, sentPasscode: boolean): JoinErrorView {
  switch (error.code) {
    case "guests_not_allowed":
      return {
        field: "form",
        message: "Only signed-in users can join this meeting. Sign in, then join again.",
        needsSignIn: true,
      };
    case "bad_passcode":
      return {
        field: "passcode",
        message: sentPasscode ? "Wrong passcode. Try again." : "This meeting needs a passcode.",
        needsSignIn: false,
      };
    case "meeting_ended":
      return { field: "form", message: "This meeting has ended.", needsSignIn: false };
    case "removed_from_meeting":
      return {
        field: "form",
        message: "The host removed you from this meeting. You cannot join it again.",
        needsSignIn: false,
      };
    case "meeting_not_found":
      return { field: "code", message: "This meeting ID is not valid. Check it and try again.", needsSignIn: false };
    default:
      return { field: "form", message: error.message, needsSignIn: false };
  }
}

type JoinAlertProps = { message: string; signInNext?: string };

/** Error box above the Join button. With `signInNext` it also shows "Sign in to join". */
export function JoinAlert({ message, signInNext }: JoinAlertProps) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="flex items-start gap-1.5">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
        {message}
      </p>
      {signInNext ? (
        <ButtonLink href={signInHref(signInNext)} size="sm" className="w-fit">
          Sign in to join
        </ButtonLink>
      ) : null}
    </div>
  );
}
