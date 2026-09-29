import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SignInCard } from "./SignInCard";

export const metadata: Metadata = { title: "Sign in" };

const points: { icon: IconName; text: string }[] = [
  { icon: "video", text: "Start a meeting in one click" },
  { icon: "calendar", text: "Schedule and share invite links" },
  { icon: "shield", text: "Control who can join" },
];

export default function SignInPage() {
  return (
    <main id="main" className="grid min-h-dvh bg-surface lg:grid-cols-2">
      {/* Brand side. On phones it becomes a short header, like the Zoom app welcome screen. */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand px-6 pt-10 pb-12 text-on-brand lg:px-14 lg:py-12">
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute top-1/3 -left-16 size-56 rounded-full bg-white/5" />

        <div className="relative flex items-baseline gap-2">
          <Logo tone="white" size="md" />
          <span className="text-lg font-semibold">Workplace</span>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <p className="max-w-md text-3xl leading-tight font-semibold tracking-tight lg:text-5xl">
            Meet, plan and talk in one place.
          </p>
          <ul className="mt-8 hidden gap-4 lg:grid">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-base text-white/90">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                  <Icon name={p.icon} size={18} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 hidden text-xs text-white/70 lg:block">
          Mockup for a study project. Not affiliated with Zoom.
        </p>
      </section>

      {/* Form side */}
      <section className="relative -mt-6 flex items-start justify-center rounded-t-2xl bg-surface px-6 pt-10 pb-12 lg:mt-0 lg:items-center lg:rounded-none">
        <SignInCard />
      </section>
    </main>
  );
}
