import { parseSignal, type SendSignal, type SignalData } from "./signaling";

// Creates and tracks one RTCPeerConnection per other participant (a mesh, docs/webrtc-plan.md).
// No React here. usePeers.ts connects it to the room socket and to the components.
//
// Who calls whom:
// 1. After each snapshot, a client does not call anybody. It sends `hello` to each connected id.
// 2. A client that gets `hello` calls the sender (it sends a fresh offer). So the clients that
//    were already in the room call the new client.
// 3. Tie: when two clients send `hello` to each other at the same time, the lower id calls.
//    When two offers cross (glare), the offer of the lower id wins.
// The server sends `participant_joined` at REST join time, before the new socket is open, so a
// signal sent then fails with `bad_target`. That is why the new client says `hello` first.

export type PeerStatus = "connecting" | "connected" | "problem";
export type SignalQuality = "good" | "fair" | "poor";
export type PeerInfo = { status: PeerStatus; quality: SignalQuality | null };

/** What the components read. A new object after each change. */
export type PeerSnapshot = {
  /** The remote stream of each participant id. Missing until the first remote track. */
  streams: ReadonlyMap<number, MediaStream>;
  info: ReadonlyMap<number, PeerInfo>;
};

export const EMPTY_PEERS: PeerSnapshot = { streams: new Map(), info: new Map() };

type MediaKind = "audio" | "video";
const KINDS: MediaKind[] = ["audio", "video"];

type Peer = {
  id: number;
  pc: RTCPeerConnection;
  /** The sid of the remote page that this connection belongs to. */
  remoteSid: string;
  stream: MediaStream | null;
  senders: Partial<Record<MediaKind, RTCRtpSender>>;
  mediaAdded: boolean;
  makingOffer: boolean;
  /** ICE candidates that came before the remote description. */
  pendingIce: RTCIceCandidateInit[];
  restarted: boolean;
  problem: boolean;
  restartTimer: ReturnType<typeof setTimeout> | null;
  quality: SignalQuality | null;
  lastPackets: { lost: number; received: number } | null;
};

export type PeerManagerOptions = {
  selfId: number;
  send: SendSignal;
  iceServers: RTCIceServer[];
  /** Tests give a fake. The default is the browser RTCPeerConnection. */
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
  /** Tests give a fake. The default is the browser MediaStream. */
  createStream?: (tracks: MediaStreamTrack[]) => MediaStream;
  /** How long an ICE restart may take before the tile shows "connection problem". */
  restartTimeoutMs?: number;
  /** How often to read getStats for the signal quality dot. 0 turns it off. */
  statsIntervalMs?: number;
  /** The id of this page. Random by default. */
  sid?: string;
};

// ---- rules (pure, unit tested) ---------------------------------------------

/** The tie rule: the client with the lower participant id is the offerer for the pair. */
export function isOfferer(selfId: number, otherId: number): boolean {
  return selfId < otherId;
}

/**
 * Should I call the sender of a `hello`? Yes, unless I also sent `hello` to that client and
 * wait for its call. Then only the lower id calls.
 */
export function shouldCallOnHello(selfId: number, from: number, waitingForCall: boolean): boolean {
  return !waitingForCall || isOfferer(selfId, from);
}

/** Two offers crossed (glare). The lower id keeps its own offer and ignores the other one. */
export function shouldIgnoreOffer(selfId: number, from: number, glare: boolean): boolean {
  return glare && isOfferer(selfId, from);
}

/** Rates the link from the round-trip time (seconds) and the share of lost packets. */
export function rateQuality(rttSeconds: number | null, lossRatio: number): SignalQuality {
  const rtt = rttSeconds ?? 0;
  if (rtt > 0.6 || lossRatio > 0.08) return "poor";
  if (rtt > 0.3 || lossRatio > 0.02) return "fair";
  return "good";
}

function isLive(pc: RTCPeerConnection): boolean {
  return pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed";
}

function randomSid(): string {
  return Math.random().toString(36).slice(2, 12);
}

// ---- manager ----------------------------------------------------------------

export class PeerManager {
  readonly sid: string;
  private readonly selfId: number;
  private readonly send: SendSignal;
  private readonly iceServers: RTCIceServer[];
  private readonly createPc: (config: RTCConfiguration) => RTCPeerConnection;
  private readonly createStream: (tracks: MediaStreamTrack[]) => MediaStream;
  private readonly restartTimeoutMs: number;
  private readonly statsIntervalMs: number;

  private readonly peers = new Map<number, Peer>();
  /** The ids that I sent `hello` to, and whose call I wait for. */
  private readonly waiting = new Set<number>();
  /** One promise chain per remote id, so the async steps of one peer never overlap. */
  private readonly chains = new Map<number, Promise<void>>();
  /** closeAll() adds 1. A queued task of an older generation does nothing. */
  private generation = 0;
  private localStream: MediaStream | null = null;
  private readonly sending: Record<MediaKind, boolean> = { audio: true, video: true };
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  private snapshot: PeerSnapshot = EMPTY_PEERS;
  private readonly listeners = new Set<() => void>();

  constructor(options: PeerManagerOptions) {
    this.selfId = options.selfId;
    this.send = options.send;
    this.iceServers = options.iceServers;
    this.createPc = options.createPeerConnection ?? ((config) => new RTCPeerConnection(config));
    this.createStream = options.createStream ?? ((tracks) => new MediaStream(tracks));
    this.restartTimeoutMs = options.restartTimeoutMs ?? 10_000;
    this.statsIntervalMs = options.statsIntervalMs ?? 3_000;
    this.sid = options.sid ?? randomSid();
  }

  // ---- store for useSyncExternalStore ----

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  // ---- inputs ----

  /** The local camera and microphone. Null means "no media": the peer only receives. */
  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
  }

  /**
   * Mute or video off. The sender drops its track, so no packets go out (a disabled track
   * would still send silence). The track comes back on unmute. No new offer is needed.
   */
  setSending(kind: MediaKind, on: boolean) {
    this.sending[kind] = on;
    const track = on ? this.localTrack(kind) : null;
    for (const peer of this.peers.values()) {
      peer.senders[kind]?.replaceTrack(track).catch(() => {});
    }
  }

  /** Call after each snapshot with its `connected_ids`. Also runs after a reconnect. */
  handleSnapshot(connectedIds: readonly number[]) {
    const others = new Set(connectedIds.filter((id) => id !== this.selfId));
    for (const id of [...this.peers.keys()]) if (!others.has(id)) this.closePeer(id);
    this.waiting.clear();
    for (const id of others) {
      const peer = this.peers.get(id);
      // A connection that still works stays. The other side keeps it too (see onHello).
      const liveSid = peer && isLive(peer.pc) ? peer.remoteSid : null;
      if (liveSid === null) this.waiting.add(id);
      this.send(id, { kind: "hello", sid: this.sid, peerSid: liveSid });
    }
  }

  /** A `signal` event from the room socket. A message with a wrong shape is dropped. */
  handleSignal(from: number, data: unknown) {
    const message = parseSignal(data);
    if (!message || from === this.selfId || message.sid === this.sid) return;
    this.enqueue(from, () => {
      switch (message.kind) {
        case "hello":
          return this.onHello(from, message);
        case "offer":
          return this.onOffer(from, message);
        case "answer":
          return this.onAnswer(from, message);
        case "ice":
          return this.onIce(from, message);
      }
    });
  }

  /** Closes the connections of the ids that are not in the participant list any more. */
  retain(ids: Iterable<number>) {
    const keep = new Set(ids);
    for (const id of [...this.peers.keys()]) if (!keep.has(id)) this.closePeer(id);
    for (const id of [...this.waiting]) if (!keep.has(id)) this.waiting.delete(id);
  }

  /** Leave, removed, ended, page unload: close every connection. The manager stays usable. */
  closeAll() {
    this.generation += 1;
    for (const id of [...this.peers.keys()]) this.closePeer(id, false);
    this.waiting.clear();
    this.chains.clear();
    this.emit();
  }

  // ---- signal handlers ----

  private async onHello(from: number, message: Extract<SignalData, { kind: "hello" }>) {
    const peer = this.peers.get(from);
    // Both sides still have the same working connection: keep it (a socket reconnect).
    if (peer && message.peerSid === this.sid && peer.remoteSid === message.sid && isLive(peer.pc)) return;
    if (!shouldCallOnHello(this.selfId, from, this.waiting.has(from))) return;
    this.waiting.delete(from);
    // A new page for this id (for example a reload) replaces the old connection.
    const fresh = this.createPeer(from, message.sid);
    this.addLocalMedia(fresh, true);
    await this.sendOffer(fresh, false);
  }

  private async onOffer(from: number, message: Extract<SignalData, { kind: "offer" }>) {
    const existing = this.peers.get(from);
    const glare = existing !== undefined && (existing.makingOffer || existing.pc.signalingState !== "stable");
    if (shouldIgnoreOffer(this.selfId, from, glare)) return;
    this.waiting.delete(from);

    let peer: Peer;
    if (existing && !message.fresh && existing.remoteSid === message.sid) {
      // An ICE restart of the connection that I have.
      peer = existing;
      if (glare) await peer.pc.setLocalDescription({ type: "rollback" });
    } else if (!message.fresh) {
      // An ICE restart for a connection that I do not have. Ask for a new one.
      this.send(from, { kind: "hello", sid: this.sid, peerSid: null });
      return;
    } else {
      // A new connection from this id replaces the old one.
      peer = this.createPeer(from, message.sid);
    }
    await peer.pc.setRemoteDescription({ type: "offer", sdp: message.sdp });
    if (!peer.mediaAdded) this.addLocalMedia(peer, false);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    if (!this.isCurrent(peer) || !peer.pc.localDescription) return;
    this.send(from, { kind: "answer", sid: this.sid, sdp: peer.pc.localDescription.sdp });
    await this.flushIce(peer);
  }

  private async onAnswer(from: number, message: Extract<SignalData, { kind: "answer" }>) {
    const peer = this.peers.get(from);
    if (!peer || peer.remoteSid !== message.sid || peer.pc.signalingState !== "have-local-offer") return;
    await peer.pc.setRemoteDescription({ type: "answer", sdp: message.sdp });
    await this.flushIce(peer);
  }

  private async onIce(from: number, message: Extract<SignalData, { kind: "ice" }>) {
    const peer = this.peers.get(from);
    // A candidate of an old page (before a reload) does not belong to this connection.
    if (!peer || peer.remoteSid !== message.sid) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingIce.push(message.candidate);
      return;
    }
    await peer.pc.addIceCandidate(message.candidate).catch(() => {});
  }

  // ---- peer connections ----

  private createPeer(id: number, remoteSid: string): Peer {
    this.closePeer(id, false); // Replace, never duplicate, the connection of this id.
    const pc = this.createPc({ iceServers: this.iceServers });
    const peer: Peer = {
      id,
      pc,
      remoteSid,
      stream: null,
      senders: {},
      mediaAdded: false,
      makingOffer: false,
      pendingIce: [],
      restarted: false,
      problem: false,
      restartTimer: null,
      quality: null,
      lastPackets: null,
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && this.isCurrent(peer))
        this.send(id, { kind: "ice", sid: this.sid, candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      if (!this.isCurrent(peer)) return;
      // A new stream object, so React sees the change and the tile finds the video track.
      const others = peer.stream?.getTracks().filter((t) => t.id !== event.track.id) ?? [];
      peer.stream = this.createStream([...others, event.track]);
      this.emit();
    };
    pc.oniceconnectionstatechange = () => this.onIceState(peer);
    this.peers.set(id, peer);
    this.startStats();
    this.emit();
    return peer;
  }

  /** Adds my tracks. Without a track of a kind, the offerer still asks to receive that kind. */
  private addLocalMedia(peer: Peer, offerer: boolean) {
    peer.mediaAdded = true;
    const stream = this.localStream;
    for (const kind of KINDS) {
      const track = this.localTrack(kind);
      if (track && stream) {
        const sender = peer.pc.addTrack(track, stream);
        peer.senders[kind] = sender;
        if (!this.sending[kind]) sender.replaceTrack(null).catch(() => {});
      } else if (offerer) {
        peer.pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }

  private async sendOffer(peer: Peer, iceRestart: boolean) {
    peer.makingOffer = true;
    try {
      const offer = await peer.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (!this.isCurrent(peer)) return;
      await peer.pc.setLocalDescription(offer);
      if (!this.isCurrent(peer) || !peer.pc.localDescription) return;
      this.send(peer.id, { kind: "offer", sid: this.sid, sdp: peer.pc.localDescription.sdp, fresh: !iceRestart });
    } finally {
      peer.makingOffer = false;
    }
  }

  private async flushIce(peer: Peer) {
    const candidates = peer.pendingIce.splice(0);
    for (const candidate of candidates) await peer.pc.addIceCandidate(candidate).catch(() => {});
  }

  /** One ICE restart after "failed". If it does not work in time, the tile shows a problem. */
  private onIceState(peer: Peer) {
    if (!this.isCurrent(peer)) return;
    const state = peer.pc.iceConnectionState;
    if (isLive(peer.pc)) {
      peer.restarted = false;
      peer.problem = false;
      if (peer.restartTimer) clearTimeout(peer.restartTimer);
      peer.restartTimer = null;
    } else if (state === "failed" && peer.restarted) {
      peer.problem = true;
    } else if (state === "failed") {
      peer.restarted = true;
      // Only one side restarts, so the two restart offers cannot cross.
      if (isOfferer(this.selfId, peer.id)) {
        const generation = this.generation;
        this.enqueue(peer.id, () => {
          if (generation === this.generation && this.isCurrent(peer)) return this.sendOffer(peer, true);
        });
      }
      peer.restartTimer = setTimeout(() => {
        if (!this.isCurrent(peer) || isLive(peer.pc)) return;
        peer.problem = true;
        this.emit();
      }, this.restartTimeoutMs);
    }
    this.emit();
  }

  private closePeer(id: number, notify = true) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    if (peer.restartTimer) clearTimeout(peer.restartTimer);
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.close();
    peer.stream?.getTracks().forEach((track) => track.stop());
    if (this.peers.size === 0) this.stopStats();
    if (notify) this.emit();
  }

  private isCurrent(peer: Peer): boolean {
    return this.peers.get(peer.id) === peer;
  }

  private localTrack(kind: MediaKind): MediaStreamTrack | null {
    return this.localStream?.getTracks().find((t) => t.kind === kind && t.readyState === "live") ?? null;
  }

  private enqueue(id: number, task: () => Promise<void> | void) {
    const generation = this.generation;
    const previous = this.chains.get(id) ?? Promise.resolve();
    const next = previous
      .then(() => (generation === this.generation ? task() : undefined))
      .catch((error: unknown) => console.warn(`WebRTC: peer ${id}:`, error));
    this.chains.set(id, next);
  }

  // ---- signal quality (getStats) ----

  private startStats() {
    if (this.statsTimer || this.statsIntervalMs <= 0) return;
    this.statsTimer = setInterval(() => {
      for (const peer of this.peers.values()) if (isLive(peer.pc)) void this.sampleQuality(peer);
    }, this.statsIntervalMs);
  }

  private stopStats() {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  private async sampleQuality(peer: Peer) {
    const report = await peer.pc.getStats().catch(() => null);
    if (!report || !this.isCurrent(peer)) return;
    let rtt: number | null = null;
    let lost = 0;
    let received = 0;
    report.forEach((stat: Record<string, unknown>) => {
      if (stat.type === "candidate-pair" && stat.nominated && typeof stat.currentRoundTripTime === "number")
        rtt = stat.currentRoundTripTime;
      if (stat.type === "inbound-rtp") {
        lost += typeof stat.packetsLost === "number" ? stat.packetsLost : 0;
        received += typeof stat.packetsReceived === "number" ? stat.packetsReceived : 0;
      }
    });
    const last = peer.lastPackets;
    peer.lastPackets = { lost, received };
    const newLost = last ? Math.max(0, lost - last.lost) : 0;
    const newReceived = last ? Math.max(0, received - last.received) : 0;
    const loss = newLost + newReceived > 0 ? newLost / (newLost + newReceived) : 0;
    const quality = rateQuality(rtt, loss);
    if (quality === peer.quality) return;
    peer.quality = quality;
    this.emit();
  }

  // ---- snapshot ----

  private emit() {
    const streams = new Map<number, MediaStream>();
    const info = new Map<number, PeerInfo>();
    for (const [id, peer] of this.peers) {
      if (peer.stream) streams.set(id, peer.stream);
      const status: PeerStatus = peer.problem ? "problem" : isLive(peer.pc) ? "connected" : "connecting";
      info.set(id, { status, quality: status === "connected" ? peer.quality : null });
    }
    this.snapshot = { streams, info };
    for (const listener of this.listeners) listener();
  }
}
