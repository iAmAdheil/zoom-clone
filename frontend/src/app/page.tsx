import type { Metadata } from "next";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { PortalShell } from "@/components/layout/PortalShell";

export const metadata: Metadata = { title: { absolute: "Home - Zoom clone" } };

export default function DashboardPage() {
  return (
    <PortalShell>
      <DashboardHome />
    </PortalShell>
  );
}
