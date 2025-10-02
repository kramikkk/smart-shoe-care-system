import StatsCard from "@/components/StatsCard"

const DashboardPage = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
      <StatsCard id="totalRevenue"/>
      <StatsCard id="totalTransactions"/>
    </div>
  )
}

export default DashboardPage