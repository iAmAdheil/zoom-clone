import type { MeetingAccess } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

/** Shows the meeting access setting in words people understand. */
export function AccessBadge({ access, tone = "light" }: { access: MeetingAccess; tone?: "light" | "dark" }) {
  if (access === "verified_only") {
    return (
      <Badge tone={tone === "dark" ? "dark" : "neutral"} icon="lock">
        Signed-in only
      </Badge>
    );
  }
  return (
    <Badge tone={tone === "dark" ? "dark" : "success"} icon="globe">
      Guests allowed
    </Badge>
  );
}
