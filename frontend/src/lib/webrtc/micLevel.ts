"use client";

import { useEffect, useState } from "react";
import { sharedAudioContext } from "./audioPlayback";

// The level of my own microphone, from a Web Audio AnalyserNode. The pre-join meter shows it,
// and the room warns when the microphone gives only silence (wrong device, muted hardware,
// or no system permission for the browser).

/** Below this RMS the signal is digital silence. A working microphone always has some noise. */
export const SILENCE_RMS = 1e-5;
/** The room warns after this much silence while the user is not muted. */
export const SILENT_WARNING_MS = 5000;

/** Root mean square of the samples (0 to 1). */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return samples.length > 0 ? Math.sqrt(sum / samples.length) : 0;
}

/** Maps the RMS to 0..1 for a meter: -60 dB is empty, 0 dB is full. */
export function meterFill(level: number): number {
  if (level <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(level) + 60) / 60));
}

export type LevelMeter = {
  /** The RMS now. Null while the AudioContext does not run (it waits for a click). */
  read: () => number | null;
  close: () => void;
};

/** A meter on the audio track of `stream`. Null when there is no track or no Web Audio. */
export function createLevelMeter(stream: MediaStream): LevelMeter | null {
  const track = stream.getAudioTracks()[0];
  const ctx = sharedAudioContext();
  if (!track || !ctx) return null;
  const source = ctx.createMediaStreamSource(new MediaStream([track]));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  // Safari runs an analyser only when it leads to the output. The gain of 0 keeps it silent.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(analyser);
  analyser.connect(mute);
  mute.connect(ctx.destination);
  const samples = new Float32Array(analyser.fftSize);
  return {
    read: () => {
      if (ctx.state !== "running") return null;
      analyser.getFloatTimeDomainData(samples);
      return rms(samples);
    },
    close: () => {
      source.disconnect();
      analyser.disconnect();
      mute.disconnect();
    },
  };
}

/** Tracks how long a microphone stays silent. Pure, so the rule is unit tested. */
export function nextSilence(silentMs: number, level: number | null, tickMs: number): number {
  if (level === null) return silentMs; // Unknown: the AudioContext does not run yet.
  return level < SILENCE_RMS ? silentMs + tickMs : 0;
}

const TICK_MS = 250;

/**
 * True when my microphone seems dead while I am not muted: the track is muted by the system,
 * or the level stays at zero for SILENT_WARNING_MS.
 */
export function useMicProblem(stream: MediaStream | null, micOn: boolean): boolean {
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track || !micOn) return;
    const meter = createLevelMeter(stream);
    let silentMs = 0;
    const timer = setInterval(() => {
      silentMs = nextSilence(silentMs, meter?.read() ?? null, TICK_MS);
      setProblem(track.muted || silentMs >= SILENT_WARNING_MS);
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      meter?.close();
      setProblem(false);
    };
  }, [stream, micOn]);

  return problem && micOn;
}
