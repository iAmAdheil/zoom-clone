"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { iceServers } from "../config";
import type { Room } from "../useRoom";
import { EMPTY_PEERS, PeerManager, type PeerSnapshot } from "./peerManager";

// Connects PeerManager (no React) to the room socket (useRoom) and to the components.
// The components only read the snapshot: remote streams and the state of each connection.

const noSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_PEERS;

function isInRoom(status: Room["status"]): boolean {
  return status === "connecting" || status === "live" || status === "reconnecting";
}

/**
 * The peer-to-peer mesh of the room. `localStream` is null for "no media".
 * Every connection closes on leave, removed, ended, a failed socket, unmount and page unload.
 */
export function usePeers(room: Room, localStream: MediaStream | null): PeerSnapshot {
  const { me, status, connectedIds, sendSignal, onSignal } = room;
  const selfId = me?.id ?? null;
  // One manager per room. MeetingRoom mounts again (new key) for a new join.
  const [manager] = useState(() =>
    selfId === null ? null : new PeerManager({ selfId, send: sendSignal, iceServers: iceServers() }),
  );
  const inRoom = isInRoom(status);
  const micOn = me ? !me.is_muted : false;
  const camOn = me ? !me.is_video_off : false;
  // A primitive dependency: the effect runs when an id comes or goes, not on each mute.
  const idsKey = room.participants.map((p) => p.id).join(",");

  useEffect(() => {
    manager?.setLocalStream(localStream);
  }, [manager, localStream]);

  useEffect(() => {
    manager?.setSending("audio", micOn);
  }, [manager, micOn]);

  useEffect(() => {
    manager?.setSending("video", camOn);
  }, [manager, camOn]);

  useEffect(() => {
    if (!manager) return;
    return onSignal((from, data) => manager.handleSignal(from, data));
  }, [manager, onSignal]);

  // Each snapshot (the first one and each one after a reconnect) says hello to the others.
  useEffect(() => {
    if (manager && connectedIds) manager.handleSnapshot(connectedIds);
  }, [manager, connectedIds]);

  // participant_left and a removal take the id out of the list: close that connection.
  useEffect(() => {
    manager?.retain(idsKey.split(",").filter(Boolean).map(Number));
  }, [manager, idsKey]);

  useEffect(() => {
    if (!manager || !inRoom) return;
    const onPageHide = () => manager.closeAll();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      manager.closeAll();
    };
  }, [manager, inRoom]);

  return useSyncExternalStore(
    manager?.subscribe ?? noSubscribe,
    manager?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );
}
