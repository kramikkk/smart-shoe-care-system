'use client'

import AreaChartCard from "@/components/AreaChartCard"
import { PieChartCard } from "@/components/PieChartCard"
import StatsCard from "@/components/StatsCard"
import RecentTransactionTable from "@/components/RecentTransactionTable"
import SystemAlertCard from "@/components/SystemAlertCard"
import SensorCard from "@/components/SensorCard"
import { SensorDataProvider } from "@/contexts/SensorDataContext"

export default function DashboardPage() {
    return (
        <SensorDataProvider>
        <div className="flex flex-col gap-4 w-full overflow-x-hidden overflow-y-scroll">
        {/* Stats and Sensor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatsCard id="totalRevenue" />
            <StatsCard id="totalTransactions" />
            <div className="sm:col-span-2 xl:col-span-1">
                <SensorCard id="systemStatus"/>
            </div>
        </div>
        
        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
                <AreaChartCard/>
            </div>
            <div className="xl:col-span-1">
                <PieChartCard/>
            </div>
        </div>
        
        {/* Transactions and Alerts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
                <RecentTransactionTable />
            </div>
            <div className="xl:col-span-1">
                <SystemAlertCard />
            </div>
        </div>
        </div>
        </SensorDataProvider>
    )
}