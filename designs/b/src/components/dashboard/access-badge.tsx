import { Globe, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Meeting } from "@/lib/types";

/** Shows who can join, and whether a passcode is set. */
export function AccessBadges({ meeting }: { meeting: Meeting }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {meeting.access === "verified_only" ? (
        <Badge tone="brand" icon={<ShieldCheck className="size-3" />}>
          Verified only
        </Badge>
      ) : (
        <Badge tone="neutral" icon={<Globe className="size-3" />}>
          Guests allowed
        </Badge>
      )}
      {meeting.passcode ? (
        <Badge tone="neutral" icon={<Lock className="size-3" />}>
          Passcode
        </Badge>
      ) : null}
    </span>
  );
}
