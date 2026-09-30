import { describe, expect, it } from "vitest";
import { parseSignal } from "./signaling";

describe("parseSignal", () => {
  it("reads a hello, with and without peerSid", () => {
    expect(parseSignal({ kind: "hello", sid: "a1", peerSid: "b2" })).toEqual({ kind: "hello", sid: "a1", peerSid: "b2" });
    expect(parseSignal({ kind: "hello", sid: "a1" })).toEqual({ kind: "hello", sid: "a1", peerSid: null });
  });

  it("reads an offer and an answer", () => {
    expect(parseSignal({ kind: "offer", sid: "a1", sdp: "v=0", fresh: true })).toEqual({
      kind: "offer",
      sid: "a1",
      sdp: "v=0",
      fresh: true,
    });
    expect(parseSignal({ kind: "answer", sid: "a1", sdp: "v=0" })).toEqual({ kind: "answer", sid: "a1", sdp: "v=0" });
  });

  it("reads an ICE candidate and fills the optional fields with null", () => {
    expect(parseSignal({ kind: "ice", sid: "a1", candidate: { candidate: "candidate:1 1 udp", sdpMLineIndex: 0 } })).toEqual({
      kind: "ice",
      sid: "a1",
      candidate: { candidate: "candidate:1 1 udp", sdpMid: null, sdpMLineIndex: 0, usernameFragment: null },
    });
  });

  it("drops the extra fields of a message", () => {
    expect(parseSignal({ kind: "answer", sid: "a1", sdp: "v=0", evil: "<script>" })).toEqual({
      kind: "answer",
      sid: "a1",
      sdp: "v=0",
    });
  });

  it.each([
    ["null", null],
    ["a string", "offer"],
    ["an array", [{ kind: "hello", sid: "a1" }]],
    ["no sid", { kind: "hello" }],
    ["an empty sid", { kind: "hello", sid: "" }],
    ["a number sid", { kind: "hello", sid: 5 }],
    ["an unknown kind", { kind: "bye", sid: "a1" }],
    ["a number peerSid", { kind: "hello", sid: "a1", peerSid: 5 }],
    ["an offer without sdp", { kind: "offer", sid: "a1", fresh: true }],
    ["an offer without fresh", { kind: "offer", sid: "a1", sdp: "v=0" }],
    ["an answer with a number sdp", { kind: "answer", sid: "a1", sdp: 1 }],
    ["ice without a candidate", { kind: "ice", sid: "a1" }],
    ["ice with a string candidate", { kind: "ice", sid: "a1", candidate: "candidate:1" }],
    ["ice with a string sdpMLineIndex", { kind: "ice", sid: "a1", candidate: { candidate: "c", sdpMLineIndex: "0" } }],
    ["ice with a number sdpMid", { kind: "ice", sid: "a1", candidate: { candidate: "c", sdpMid: 0 } }],
  ])("rejects %s", (_label, data) => {
    expect(parseSignal(data)).toBeNull();
  });
});
