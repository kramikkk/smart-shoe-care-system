import AreaChartCard from "@/components/AreaChartCard"
import { PieChartCard } from "@/components/PieChartCard"
import StatsCard from "@/components/StatsCard"
import RecentTransactionTable from "@/components/RecentTransactionTable"
import SystemAlertCard from "@/components/SystemAlertCard"
import SensorCard from "@/components/SensorCard"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
          headers: await headers(),
    });
        if (!session) {
        redirect("/admin/login");
        }
    return (
        <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            <StatsCard id="totalRevenue" />
            <StatsCard id="totalTransactions" />
            <div className="">
                <SensorCard id="systemStatus"/>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
                <AreaChartCard/>
            </div>
            <PieChartCard/>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
                <RecentTransactionTable />
            </div>
            <SystemAlertCard />
        </div>
        </div>
    )
}