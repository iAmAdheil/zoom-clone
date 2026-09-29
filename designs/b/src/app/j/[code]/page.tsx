import type { Metadata } from "next";
import { JoinScreen } from "@/components/join/join-screen";

export const metadata: Metadata = { title: "Join a meeting · Zoom Workplace clone" };

/** Invite links (/j/{code}) open the join screen with the ID filled in. */
export default async function InviteLinkPage(props: PageProps<"/j/[code]">) {
  const { code } = await props.params;
  return <JoinScreen initialCode={code.replace(/\D/g, "")} />;
}
