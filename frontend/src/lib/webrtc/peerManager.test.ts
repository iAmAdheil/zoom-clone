import { afterEach, describe, expect, it } from "vitest";
import {
  PeerManager,
  isOfferer,
  rateQuality,
  shouldCallOnHello,
  shouldIgnoreOffer,
  type PeerManagerOptions,
} from "./peerManager";
import type { SignalData } from "./signaling";

type FakeTrack = { kind: string; id: string; readyState: "live" | "ended" };

/** A local track. PeerManager reads only `kind`, `id` and `readyState`. */
function track(kind: "audio" | "video", id = `${kind}-1`): FakeTrack {
  return { kind, id, readyState: "live" };
}

function stream(...tracks: FakeTrack[]): MediaStream {
  return { getTracks: () => tracks } as unknown as MediaStream;
}

// A sender whose replaceTrack takes the time that the test sets. A real browser can also take
// time, so the calls of one peer must not overlap.
class FakeSender {
  static delays: number[] = [];
  track: FakeTrack | null;
  calls: (string | null)[] = [];
  constructor(initial: FakeTrack | null) {
    this.track = initial;
  }
  async replaceTrack(next: FakeTrack | null) {
    this.calls.push(next?.id ?? null);
    const delay = FakeSender.delays.shift() ?? 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    this.track = next;
  }
}

type FakeTransceiver = { kind: string; direction: string; sender: FakeSender; receiver: { track: { kind: string } } };

function transceiver(kind: string, direction: string, initial: FakeTrack | null = null): FakeTransceiver {
  return { kind, direction, sender: new FakeSender(initial), receiver: { track: { kind } } };
}

// A fake RTCPeerConnection with the parts that PeerManager uses. No network, no media.
class FakePeerConnection {
  static all: FakePeerConnection[] = [];
  signalingState: RTCSignalingState = "stable";
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  transceiverList: FakeTransceiver[] = [];
  candidates: RTCIceCandidateInit[] = [];
  stats: Record<string, unknown>[] = [];
  offers = 0;
  closed = false;
  onicecandidate: ((event: { candidate: null }) => void) | null = null;
  ontrack: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;

  constructor() {
    FakePeerConnection.all.push(this);
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    this.offers += 1;
    return { type: "offer", sdp: options?.iceRestart ? "restart-offer" : "offer" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "answer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    if (description.type === "rollback") {
      this.localDescription = null;
      this.signalingState = "stable";
      return;
    }
    this.localDescription = description;
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
    this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
    // Like a browser: the first offer makes one receiving transceiver per media line.
    if (description.type === "offer" && this.transceiverList.length === 0)
      this.transceiverList.push(transceiver("audio", "recvonly"), transceiver("video", "recvonly"));
  }

  addTransceiver(trackOrKind: FakeTrack | string, init: RTCRtpTransceiverInit) {
    const initial = typeof trackOrKind === "string" ? null : trackOrKind;
    const added = transceiver(initial?.kind ?? (trackOrKind as string), init.direction ?? "sendrecv", initial);
    this.transceiverList.push(added);
    return added;
  }

  getTransceivers() {
    return this.transceiverList;
  }

  /** The kind and direction of each transceiver, for short checks. */
  get transceivers(): string[] {
    return this.transceiverList.map((t) => `${t.kind}:${t.direction}`);
  }

  sender(kind: string): FakeSender {
    return this.transceiverList.find((t) => t.kind === kind)!.sender;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.candidates.push(candidate);
  }

  async getStats() {
    return new Map(this.stats.map((stat, i) => [String(i), stat]));
  }

  close() {
    this.closed = true;
    this.signalingState = "closed";
  }

  /** Test helper: change the ICE state and fire the event. */
  setIce(state: RTCIceConnectionState) {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }
}

type Sent = { from: number; to: number; data: SignalData };

/** Waits until every queued promise step has run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeManager(selfId: number, sent: Sent[], extra: Partial<PeerManagerOptions> = {}) {
  return new PeerManager({
    selfId,
    sid: `sid-${selfId}`,
    iceServers: [],
    statsIntervalMs: 0,
    createPeerConnection: () => new FakePeerConnection() as unknown as RTCPeerConnection,
    send: (to, data) => {
      sent.push({ from: selfId, to, data });
      return true;
    },
    ...extra,
  });
}

/** Two or more managers that deliver signals to each other, like the server relay. */
function makeMesh(ids: number[]) {
  const sent: Sent[] = [];
  const managers = new Map<number, PeerManager>();
  for (const id of ids) {
    managers.set(
      id,
      makeManager(id, sent, {
        send: (to, data) => {
          sent.push({ from: id, to, data });
          const copy = JSON.parse(JSON.stringify(data)) as unknown;
          queueMicrotask(() => managers.get(to)?.handleSignal(id, copy));
          return true;
        },
      }),
    );
  }
  return { sent, managers };
}

const kinds = (sent: Sent[], kind: SignalData["kind"]) => sent.filter((s) => s.data.kind === kind);

afterEach(() => {
  FakePeerConnection.all = [];
  FakeSender.delays = [];
});

describe("offerer rule", () => {
  it("makes the lower id the offerer of a pair", () => {
    expect(isOfferer(3, 7)).toBe(true);
    expect(isOfferer(7, 3)).toBe(false);
  });

  it("answers a hello with a call unless both wait and I am the higher id", () => {
    expect(shouldCallOnHello(7, 3, false)).toBe(true);
    expect(shouldCallOnHello(3, 7, false)).toBe(true);
    expect(shouldCallOnHello(3, 7, true)).toBe(true);
    expect(shouldCallOnHello(7, 3, true)).toBe(false);
  });

  it("lets the lower id keep its offer in glare", () => {
    expect(shouldIgnoreOffer(3, 7, true)).toBe(true);
    expect(shouldIgnoreOffer(7, 3, true)).toBe(false);
    expect(shouldIgnoreOffer(3, 7, false)).toBe(false);
  });

  it("rates the signal quality", () => {
    expect(rateQuality(0.05, 0)).toBe("good");
    expect(rateQuality(null, 0)).toBe("good");
    expect(rateQuality(0.4, 0)).toBe("fair");
    expect(rateQuality(0.05, 0.05)).toBe("fair");
    expect(rateQuality(0.9, 0)).toBe("poor");
    expect(rateQuality(0.05, 0.2)).toBe("poor");
  });
});

describe("PeerManager", () => {
  it("says hello to each connected id after a snapshot and calls nobody", () => {
    const sent: Sent[] = [];
    const manager = makeManager(5, sent);
    manager.handleSnapshot([2, 5, 9]);
    expect(sent.map((s) => [s.to, s.data.kind])).toEqual([
      [2, "hello"],
      [9, "hello"],
    ]);
    expect(FakePeerConnection.all).toHaveLength(0);
  });

  it("calls the sender of a hello, with an empty sendrecv sender per kind when it has no media", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    expect(sent).toEqual([{ from: 2, to: 9, data: { kind: "offer", sid: "sid-2", sdp: "offer", fresh: true } }]);
    const pc = FakePeerConnection.all[0];
    expect(pc.transceivers).toEqual(["audio:sendrecv", "video:sendrecv"]);
    expect(pc.sender("audio").track).toBeNull();
  });

  it("connects an old client to a new client with one offer", async () => {
    const { sent, managers } = makeMesh([4, 8]);
    managers.get(8)!.handleSnapshot([4, 8]); // 8 is new. 4 was in the room before.
    await settle();
    expect(kinds(sent, "offer").map((s) => s.from)).toEqual([4]);
    expect(kinds(sent, "answer").map((s) => s.from)).toEqual([8]);
    expect(FakePeerConnection.all).toHaveLength(2);
    expect(FakePeerConnection.all.every((pc) => pc.signalingState === "stable")).toBe(true);
  });

  it("lets only the lower id call when two new clients say hello at once", async () => {
    const { sent, managers } = makeMesh([4, 8]);
    managers.get(4)!.handleSnapshot([4, 8]);
    managers.get(8)!.handleSnapshot([4, 8]);
    await settle();
    expect(kinds(sent, "offer").map((s) => s.from)).toEqual([4]);
    expect(FakePeerConnection.all).toHaveLength(2);
  });

  it("keeps the lower id's offer when two offers cross", async () => {
    const sentLow: Sent[] = [];
    const sentHigh: Sent[] = [];
    const low = makeManager(3, sentLow);
    const high = makeManager(7, sentHigh);
    // Both call at the same time, so both have a local offer.
    low.handleSignal(7, { kind: "hello", sid: "sid-7", peerSid: null });
    high.handleSignal(3, { kind: "hello", sid: "sid-3", peerSid: null });
    await settle();
    const [lowPc, highPc] = FakePeerConnection.all;

    low.handleSignal(7, kinds(sentHigh, "offer")[0].data);
    high.handleSignal(3, kinds(sentLow, "offer")[0].data);
    await settle();

    expect(kinds(sentLow, "answer")).toHaveLength(0); // The lower id ignores the other offer.
    expect(lowPc.closed).toBe(false);
    expect(kinds(sentHigh, "answer")).toHaveLength(1); // The higher id answers the lower id.
    expect(highPc.closed).toBe(true); // Its own offer is dropped with the old connection.
  });

  it("replaces the connection when a participant reloads (new sid)", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(9, { kind: "hello", sid: "page-1", peerSid: null });
    await settle();
    manager.handleSignal(9, { kind: "hello", sid: "page-2", peerSid: null });
    await settle();
    const [first, second] = FakePeerConnection.all;
    expect(first.closed).toBe(true);
    expect(second.closed).toBe(false);
    expect(manager.getSnapshot().info.size).toBe(1);
    expect(kinds(sent, "offer")).toHaveLength(2);
  });

  it("replaces the connection when a fresh offer comes from a new page", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(9, sent);
    manager.handleSignal(2, { kind: "offer", sid: "page-1", sdp: "offer", fresh: true });
    await settle();
    manager.handleSignal(2, { kind: "offer", sid: "page-2", sdp: "offer", fresh: true });
    await settle();
    expect(FakePeerConnection.all.map((pc) => pc.closed)).toEqual([true, false]);
    expect(kinds(sent, "answer")).toHaveLength(2);
  });

  it("keeps a working connection after a socket reconnect", async () => {
    const { sent, managers } = makeMesh([4, 8]);
    managers.get(8)!.handleSnapshot([4, 8]);
    await settle();
    FakePeerConnection.all.forEach((pc) => pc.setIce("connected"));
    sent.length = 0;

    managers.get(8)!.handleSnapshot([4, 8]); // The socket of 8 reconnected.
    await settle();
    expect(sent.map((s) => s.data.kind)).toEqual(["hello"]);
    expect(FakePeerConnection.all).toHaveLength(2);
  });

  it("rebuilds a connection that is not connected after a socket reconnect", async () => {
    const { sent, managers } = makeMesh([4, 8]);
    managers.get(8)!.handleSnapshot([4, 8]);
    await settle();
    sent.length = 0;

    managers.get(8)!.handleSnapshot([4, 8]); // ICE never connected.
    await settle();
    expect(kinds(sent, "offer").map((s) => s.from)).toEqual([4]);
    expect(FakePeerConnection.all.filter((pc) => !pc.closed)).toHaveLength(2);
  });

  it("queues ICE candidates that come before the remote description", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    const candidate = { candidate: "candidate:1 1 udp 1 10.0.0.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    manager.handleSignal(9, { kind: "ice", sid: "sid-9", candidate });
    await settle();
    const pc = FakePeerConnection.all[0];
    expect(pc.candidates).toHaveLength(0);
    manager.handleSignal(9, { kind: "answer", sid: "sid-9", sdp: "answer" });
    await settle();
    expect(pc.candidates).toHaveLength(1);
  });

  it("ignores signals of an old page and bad messages", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    manager.handleSignal(9, { kind: "answer", sid: "old-page", sdp: "answer" });
    manager.handleSignal(9, { kind: "nonsense" });
    manager.handleSignal(9, "not an object");
    await settle();
    expect(FakePeerConnection.all[0].signalingState).toBe("have-local-offer");
  });

  it("closes the connection of a participant who left, and all of them on closeAll", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(5, { kind: "hello", sid: "sid-5", peerSid: null });
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    manager.retain([2, 9]);
    expect(FakePeerConnection.all.map((pc) => pc.closed)).toEqual([true, false]);
    expect([...manager.getSnapshot().info.keys()]).toEqual([9]);
    manager.closeAll();
    expect(FakePeerConnection.all.every((pc) => pc.closed)).toBe(true);
    expect(manager.getSnapshot().info.size).toBe(0);
  });

  it("tries one ICE restart, then shows a connection problem", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent, { restartTimeoutMs: 20 });
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    const pc = FakePeerConnection.all[0];
    manager.handleSignal(9, { kind: "answer", sid: "sid-9", sdp: "answer" });
    await settle();
    pc.setIce("connected");
    expect(manager.getSnapshot().info.get(9)?.status).toBe("connected");

    pc.setIce("failed");
    await settle();
    const restarts = kinds(sent, "offer").filter((s) => s.data.kind === "offer" && !s.data.fresh);
    expect(restarts).toHaveLength(1);
    expect(manager.getSnapshot().info.get(9)?.status).toBe("connecting");

    await wait(40);
    expect(manager.getSnapshot().info.get(9)?.status).toBe("problem");
    pc.setIce("connected");
    expect(manager.getSnapshot().info.get(9)?.status).toBe("connected");
  });

  it("does not restart ICE from the higher id", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(9, sent, { restartTimeoutMs: 20 });
    manager.handleSignal(2, { kind: "offer", sid: "sid-2", sdp: "offer", fresh: true });
    await settle();
    FakePeerConnection.all[0].setIce("failed");
    await settle();
    expect(kinds(sent, "offer")).toHaveLength(0);
  });
});

// The rule: the audio sender always ends with `sending ? live microphone track : null`, the same
// state that the Mute button shows. The UI and useTrackToggles read the same `is_muted` flag.
describe("mute state of the senders", () => {
  /** A manager with one open connection to peer 9, as the offerer. */
  async function connected(localStream: MediaStream | null, sending = true) {
    const manager = makeManager(2, []);
    manager.setLocalStream(localStream);
    manager.setSending("audio", sending);
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    return { manager, pc: FakePeerConnection.all[0] };
  }

  it("sends the microphone when unmuted and nothing when muted at join", async () => {
    const mic = track("audio");
    expect((await connected(stream(mic), true)).pc.sender("audio").track).toBe(mic);
    FakePeerConnection.all = [];
    expect((await connected(stream(mic), false)).pc.sender("audio").track).toBeNull();
  });

  it("ends in the last state when slow replaceTrack calls overlap", async () => {
    const mic = track("audio");
    const { manager, pc } = await connected(stream(mic));
    // The first call (mute) is slow, the second (unmute) is fast. Out of order, the mute
    // would land last and leave me muted while the button says "Mute".
    FakeSender.delays = [30, 0, 0];
    manager.setSending("audio", false);
    manager.setSending("audio", true);
    await wait(60);
    expect(pc.sender("audio").track).toBe(mic);

    FakeSender.delays = [0, 30];
    manager.setSending("audio", true);
    manager.setSending("audio", false);
    await wait(60);
    expect(pc.sender("audio").track).toBeNull();
  });

  it("puts a microphone that opens late into the open connection, with no new offer", async () => {
    const { manager, pc } = await connected(null);
    const offers = pc.offers;
    expect(pc.sender("audio").track).toBeNull();
    const mic = track("audio");
    manager.setLocalStream(stream(mic));
    await settle();
    expect(pc.sender("audio").track).toBe(mic);
    expect(pc.offers).toBe(offers);
  });

  it("keeps a late microphone off while muted, and sends it on unmute", async () => {
    const { manager, pc } = await connected(null, false);
    const mic = track("audio");
    manager.setLocalStream(stream(mic));
    await settle();
    expect(pc.sender("audio").track).toBeNull();
    manager.setSending("audio", true);
    await settle();
    expect(pc.sender("audio").track).toBe(mic);
  });

  it("switches to a new microphone only while unmuted", async () => {
    const first = track("audio", "mic-a");
    const second = track("audio", "mic-b");
    const { manager, pc } = await connected(stream(first));
    manager.setLocalStream(stream(second));
    await settle();
    expect(pc.sender("audio").track).toBe(second);
    manager.setSending("audio", false);
    manager.setLocalStream(stream(first));
    await settle();
    expect(pc.sender("audio").track).toBeNull();
  });

  it("sends nothing for an ended track", async () => {
    const mic = track("audio");
    const { manager, pc } = await connected(stream(mic));
    mic.readyState = "ended";
    manager.setLocalStream(stream(mic));
    await settle();
    expect(pc.sender("audio").track).toBeNull();
  });

  it("answers with the offer's transceivers set to sendrecv and my tracks in them", async () => {
    const mic = track("audio");
    const cam = track("video");
    const manager = makeManager(9, []);
    manager.setLocalStream(stream(mic, cam));
    manager.handleSignal(2, { kind: "offer", sid: "sid-2", sdp: "offer", fresh: true });
    await settle();
    const pc = FakePeerConnection.all[0];
    expect(pc.transceivers).toEqual(["audio:sendrecv", "video:sendrecv"]);
    expect(pc.sender("audio").track).toBe(mic);
    expect(pc.sender("video").track).toBe(cam);
  });
});

describe("remote audio monitor", () => {
  const inbound = (bytes: number, audioLevel?: number) => ({ type: "inbound-rtp", kind: "audio", bytesReceived: bytes, audioLevel });

  async function live(now: { t: number }) {
    const manager = makeManager(2, [], { now: () => now.t });
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    const pc = FakePeerConnection.all[0];
    pc.setIce("connected");
    return { manager, pc };
  }

  it("shows the speaker frame from the real audio level", async () => {
    const now = { t: 0 };
    const { manager, pc } = await live(now);
    pc.stats = [inbound(1000, 0.2)];
    await manager.sampleStats(9);
    now.t = 500;
    pc.stats = [inbound(2000, 0.2)];
    await manager.sampleStats(9);
    expect(manager.getSnapshot().info.get(9)?.speaking).toBe(true);

    // Quiet for longer than the hold time: the frame goes away.
    for (const t of [1000, 1500, 2000]) {
      now.t = t;
      pc.stats = [inbound(2000 + t, 0.001)];
      await manager.sampleStats(9);
    }
    expect(manager.getSnapshot().info.get(9)?.speaking).toBe(false);
  });

  it("flags no audio after 5 seconds without new bytes, and clears it when bytes come", async () => {
    const now = { t: 0 };
    const { manager, pc } = await live(now);
    pc.stats = [inbound(500, 0)];
    await manager.sampleStats(9);
    now.t = 4000;
    await manager.sampleStats(9);
    expect(manager.getSnapshot().info.get(9)?.noAudio).toBe(false);
    now.t = 5000;
    await manager.sampleStats(9);
    expect(manager.getSnapshot().info.get(9)?.noAudio).toBe(true);
    now.t = 5500;
    pc.stats = [inbound(900, 0)];
    await manager.sampleStats(9);
    expect(manager.getSnapshot().info.get(9)?.noAudio).toBe(false);
  });
});
