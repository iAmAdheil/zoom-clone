import { describe, expect, it } from "vitest";
import { deviceOptions } from "./devices";
import { mediaMessage, openDevices, statusOfError, unblockHint, type GetUserMedia } from "./mediaAccess";
import { SILENCE_RMS, meterFill, nextSilence, rms } from "./micLevel";
import { isAudioMissing, isSpeaking, nextAudioProbe, readInboundAudio } from "./peerManager";

const fail = (name: string) => Promise.reject(new DOMException("test", name));
const fakeTrack = (kind: string) => ({ kind }) as MediaStreamTrack;
const fakeStream = (...kinds: string[]) => ({ getTracks: () => kinds.map(fakeTrack) }) as unknown as MediaStream;

describe("openDevices", () => {
  it("opens both devices with one call", async () => {
    const calls: MediaStreamConstraints[] = [];
    const gum: GetUserMedia = async (c) => {
      calls.push(c);
      return fakeStream("audio", "video");
    };
    const opened = await openDevices(["audio", "video"], gum);
    expect(opened.status).toEqual({ audio: "ok", video: "ok" });
    expect(calls).toHaveLength(1);
    // The voice processing is asked for on purpose.
    expect(calls[0].audio).toEqual({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
  });

  it("keeps an allowed microphone when the camera is refused", async () => {
    const gum: GetUserMedia = (c) => (c.video ? fail("NotAllowedError") : Promise.resolve(fakeStream("audio")));
    const opened = await openDevices(["audio", "video"], gum);
    expect(opened.status).toEqual({ audio: "ok", video: "blocked" });
    expect(opened.tracks.map((t) => t.kind)).toEqual(["audio"]);
  });

  it("keeps the camera when the microphone is busy", async () => {
    const gum: GetUserMedia = (c) => (c.audio ? fail("NotReadableError") : Promise.resolve(fakeStream("video")));
    const opened = await openDevices(["audio", "video"], gum);
    expect(opened.status).toEqual({ audio: "busy", video: "ok" });
  });

  it("reports no device and no browser support", async () => {
    expect((await openDevices(["audio"], () => fail("NotFoundError"))).status).toEqual({ audio: "missing" });
    expect((await openDevices(["audio", "video"], null)).status).toEqual({ audio: "unsupported", video: "unsupported" });
  });

  it("maps the error names", () => {
    expect(statusOfError(new DOMException("x", "SecurityError"))).toBe("blocked");
    expect(statusOfError(new DOMException("x", "OverconstrainedError"))).toBe("missing");
    expect(statusOfError(new DOMException("x", "AbortError"))).toBe("busy");
  });
});

describe("device messages", () => {
  it("says nothing when all is well or not asked yet", () => {
    expect(mediaMessage({ audio: "ok", video: "ok" })).toBeNull();
    expect(mediaMessage({ audio: "idle", video: "idle" })).toBeNull();
  });

  it("says that others cannot hear me when only the microphone fails", () => {
    expect(mediaMessage({ audio: "blocked", video: "ok" })).toBe(
      "The microphone is blocked. You join with the camera only. Others cannot hear you.",
    );
  });

  it("says that I join with the microphone only when the camera fails", () => {
    expect(mediaMessage({ audio: "ok", video: "busy" })).toBe(
      "Another app is using the camera. You join with the microphone only.",
    );
  });

  it("joins the two problems in one sentence when they match", () => {
    expect(mediaMessage({ audio: "blocked", video: "blocked" })).toBe(
      "The camera and microphone are blocked. You can join and still see and hear others.",
    );
  });

  it("gives steps for the browser of the user", () => {
    expect(unblockHint("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1")).toMatch(/aA/);
    expect(unblockHint("Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/120 Mobile Safari/537.36")).toMatch(/^On Android/);
    expect(unblockHint("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605.1.15")).toMatch(/^In Safari/);
    expect(unblockHint("Mozilla/5.0 (Macintosh) AppleWebKit Version/17 Safari/605.1.15", 5)).toMatch(/iPad/);
    expect(unblockHint("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36")).toMatch(/lock icon/);
  });
});

describe("device lists", () => {
  const device = (kind: MediaDeviceKind, deviceId: string, label = "") => ({ kind, deviceId, label, groupId: "" }) as MediaDeviceInfo;

  it("names the devices when the browser hides the labels", () => {
    const list = [device("audioinput", "a"), device("audioinput", "b", "USB mic"), device("videoinput", "c")];
    expect(deviceOptions(list, "audioinput")).toEqual([
      { id: "a", label: "Microphone 1" },
      { id: "b", label: "USB mic" },
    ]);
  });

  it("leaves out entries with no id (before permission) and repeated ids", () => {
    const list = [device("audioinput", ""), device("audiooutput", "x", "Speakers"), device("audiooutput", "x", "Speakers")];
    expect(deviceOptions(list, "audioinput")).toEqual([]);
    expect(deviceOptions(list, "audiooutput")).toEqual([{ id: "x", label: "Speakers" }]);
  });
});

describe("microphone level", () => {
  it("measures RMS and fills the meter on a dB scale", () => {
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(meterFill(0)).toBe(0);
    expect(meterFill(1)).toBe(1);
    expect(meterFill(0.001)).toBe(0); // -60 dB
  });

  it("counts silence only while the audio runs", () => {
    expect(nextSilence(1000, 0, 250)).toBe(1250);
    expect(nextSilence(1000, SILENCE_RMS * 10, 250)).toBe(0);
    expect(nextSilence(1000, null, 250)).toBe(1000);
  });
});

describe("remote audio probe", () => {
  it("reads the inbound audio of a stats report", () => {
    const stats = [
      { type: "inbound-rtp", kind: "video", bytesReceived: 9 },
      { type: "inbound-rtp", kind: "audio", bytesReceived: 7, audioLevel: 0.1, totalAudioEnergy: 1, totalSamplesDuration: 2 },
    ];
    expect(readInboundAudio(stats)).toEqual({ bytes: 7, level: 0.1, energy: 1, duration: 2 });
    expect(readInboundAudio([])).toBeNull();
  });

  it("uses the energy when the browser gives no audioLevel", () => {
    const first = nextAudioProbe(null, { bytes: 100, level: null, energy: 0, duration: 0 }, 0);
    const second = nextAudioProbe(first, { bytes: 200, level: null, energy: 0.01, duration: 1 }, 500);
    expect(second.level).toBeCloseTo(0.1);
    expect(isSpeaking(second, 500)).toBe(true);
  });

  it("never counts a stale level as speech when no bytes come", () => {
    const first = nextAudioProbe(null, { bytes: 100, level: 0.5, energy: null, duration: null }, 0);
    const second = nextAudioProbe(first, { bytes: 100, level: 0.5, energy: null, duration: null }, 500);
    expect(second.level).toBe(0);
    expect(isSpeaking(second, 500)).toBe(false);
    expect(isAudioMissing(second, 4999)).toBe(false);
    expect(isAudioMissing(second, 5000)).toBe(true);
  });
});
