import type { Metadata } from "next";
import { JoinPage } from "@/components/join/JoinPage";

export const metadata: Metadata = { title: "Join a meeting" };

export default function Page() {
  return <JoinPage />;
}
