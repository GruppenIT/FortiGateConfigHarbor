import { MainLayout } from "@/components/layout/main-layout";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ComplianceTable } from "@/components/dashboard/compliance-table";
import { SystemHealth } from "@/components/dashboard/system-health";
import { QuarantineTable } from "@/components/dashboard/quarantine-table";

export default function Dashboard() {
  return (
    <MainLayout title="Visão Geral do Sistema">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Key Metrics Cards */}
          <MetricsCards />

          {/* Recent Activity and Device Overview */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <ActivityFeed />
            {/* Top Devices component would go here */}
          </div>

          {/* Compliance Overview and System Health */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ComplianceTable />
            </div>
            <SystemHealth />
          </div>

          {/* Recent Quarantine Items */}
          <div className="mt-8">
            <QuarantineTable />
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
