import type { Metadata } from "next";
import { JoinPage } from "@/components/join/JoinPage";

export const metadata: Metadata = { title: "Join a meeting" };

/** Invite links land here with the meeting ID already filled in. */
export default async function Page({ params }: PageProps<"/j/[code]">) {
  const { code } = await params;
  return <JoinPage initialCode={code} />;
}
