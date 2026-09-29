"use client";

import { useNow } from "@/lib/hooks";

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Greeting that uses the viewer's clock. The server renders a neutral text. */
export function Greeting({ firstName }: { firstName: string }) {
  const now = useNow();
  const text = now ? greetingFor(now.getHours()) : "Welcome back";
  return (
    <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">
      {text}, {firstName}
    </h1>
  );
}

/** Large clock for the Today card. */
export function Clock() {
  const now = useNow();
  const time = now
    ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "--:--";
  const date = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : " ";
  return (
    <div>
      <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
        {time}
      </p>
      <p className="mt-1 text-sm text-white/80">{date}</p>
    </div>
  );
}
