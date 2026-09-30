import type { ReactNode } from "react";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";

type MeetingNoticeProps = {
  icon?: IconName;
  title: string;
  detail?: string;
  /** The buttons. Default: "Back to Home". */
  children?: ReactNode;
};

/** Full-page message in the light shell: "meeting not found", "meeting ended", and so on. */
export function MeetingNotice({ icon = "video", title, detail, children }: MeetingNoticeProps) {
  return (
    <SimpleShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="rounded-full bg-primary-soft p-3 text-primary">
          <Icon name={icon} size={28} />
        </span>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {detail ? <p className="max-w-md text-sm text-ink-muted">{detail}</p> : null}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {children ?? <ButtonLink href="/">Back to Home</ButtonLink>}
        </div>
      </div>
    </SimpleShell>
  );
}
