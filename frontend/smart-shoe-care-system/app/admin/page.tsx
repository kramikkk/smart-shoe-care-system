import AreaChartCard from "@/components/AreaChartCard"
import { PieChartCard } from "@/components/PieChartCard"
import StatsCard from "@/components/StatsCard"
import RecentTransactionTable from "@/components/RecentTransactionTable"

const DashboardPage = () => {
    return (
        <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
            <StatsCard id="totalRevenue" />
            <StatsCard id="totalTransactions" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AreaChartCard/>
            <PieChartCard/>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentTransactionTable />
          
        </div>
        </div>
    )
}

export default DashboardPage