import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { PortalShell } from "@/components/layout/PortalShell";

export default function DashboardPage() {
  return (
    <PortalShell>
      <DashboardHome />
    </PortalShell>
  );
}
