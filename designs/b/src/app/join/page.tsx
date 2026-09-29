import type { Metadata } from "next";
import { JoinScreen } from "@/components/join/join-screen";

export const metadata: Metadata = { title: "Join a meeting · Zoom Workplace clone" };

export default function JoinPage() {
  return <JoinScreen />;
}
