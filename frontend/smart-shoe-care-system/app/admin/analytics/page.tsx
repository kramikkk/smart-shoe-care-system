import AreaChartCard from "@/components/AreaChartCard"
import { PieChartCard } from "@/components/PieChartCard"
import StatsCard from "@/components/StatsCard"

const AnalyticsPage = () => {
    return (
        <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
            <StatsCard id="totalRevenue" />
            <StatsCard id="totalTransactions" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AreaChartCard id="revenue"/>
            <PieChartCard/>
            <AreaChartCard id="transactions"/>
        </div>
        </div>
    )
}

export default AnalyticsPage