"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { createLevelMeter, meterFill } from "@/lib/webrtc/micLevel";

/**
 * A live bar of my microphone level. It draws on each animation frame through a ref, so the
 * component itself never renders again while the level moves.
 */
export function MicLevelMeter({ stream, on, className }: { stream: MediaStream | null; on: boolean; className?: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!stream || !on || !bar) return;
    const meter = createLevelMeter(stream);
    if (!meter) return;
    let frame = requestAnimationFrame(function draw() {
      bar.style.transform = `scaleX(${meterFill(meter.read() ?? 0)})`;
      frame = requestAnimationFrame(draw);
    });
    return () => {
      cancelAnimationFrame(frame);
      meter.close();
      bar.style.transform = "scaleX(0)";
    };
  }, [stream, on]);

  return (
    <div aria-hidden="true" className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div ref={barRef} className="h-full origin-left scale-x-0 rounded-full bg-success" />
    </div>
  );
}
