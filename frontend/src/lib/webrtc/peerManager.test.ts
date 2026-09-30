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

// A fake RTCPeerConnection with the parts that PeerManager uses. No network, no media.
class FakePeerConnection {
  static all: FakePeerConnection[] = [];
  signalingState: RTCSignalingState = "stable";
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  transceivers: string[] = [];
  candidates: RTCIceCandidateInit[] = [];
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
  }

  addTransceiver(kind: string, init: RTCRtpTransceiverInit) {
    this.transceivers.push(`${kind}:${init.direction}`);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.candidates.push(candidate);
  }

  async getStats() {
    return new Map();
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

  it("calls the sender of a hello, and asks to receive when it has no media", async () => {
    const sent: Sent[] = [];
    const manager = makeManager(2, sent);
    manager.handleSignal(9, { kind: "hello", sid: "sid-9", peerSid: null });
    await settle();
    expect(sent).toEqual([{ from: 2, to: 9, data: { kind: "offer", sid: "sid-2", sdp: "offer", fresh: true } }]);
    expect(FakePeerConnection.all[0].transceivers).toEqual(["audio:recvonly", "video:recvonly"]);
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
