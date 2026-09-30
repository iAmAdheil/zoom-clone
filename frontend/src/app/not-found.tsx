import type { Metadata } from "next";
import { MeetingNotice } from "@/components/meeting/MeetingNotice";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <MeetingNotice icon="alert" title="Page not found" detail="This page does not exist. Check the link and try again." />;
}
