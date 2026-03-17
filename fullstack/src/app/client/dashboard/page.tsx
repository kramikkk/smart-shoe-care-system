'use client'

import { motion } from "motion/react"
import AreaChartCard from "@/components/dashboard/AreaChartCard"
import { PieChartCard } from "@/components/dashboard/PieChartCard"
import StatsCard from "@/components/dashboard/StatsCard"
import RecentTransactionTable from "@/components/dashboard/RecentTransactionTable"
import SystemAlertCard from "@/components/monitoring/SystemAlertCard"
import SensorCard from "@/components/monitoring/SensorCard"
import { SensorDataProvider } from "@/contexts/SensorDataContext"

import { useSession } from "@/lib/auth-client"

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            staggerChildren: 0.1
        }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
}

export default function DashboardPage() {
    const { data: session } = useSession()
    const userName = session?.user?.name || "User"

    return (
        <SensorDataProvider>
        <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="flex flex-col gap-6 w-full overflow-x-hidden overflow-y-auto pb-8"
        >
            {/* Header / Welcome Area (Optional, but adds premium feel) */}
            <motion.div variants={itemVariants} className="mb-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    Welcome Back, <span className="text-primary">{userName}!</span>
                </h1>
                <p className="text-muted-foreground">Monitor your shoe care systems in real-time.</p>
            </motion.div>

            {/* Stats and Sensor Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                <StatsCard id="totalRevenue" />
                <StatsCard id="totalTransactions" />
                <div className="sm:col-span-2 xl:col-span-1">
                    <SensorCard id="systemStatus"/>
                </div>
            </motion.div>
            
            {/* Charts Section */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                    <AreaChartCard/>
                </div>
                <div className="xl:col-span-1">
                    <PieChartCard/>
                </div>
            </motion.div>
            
            {/* Transactions and Alerts Section */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
                <div className="xl:col-span-2 h-full">
                    <RecentTransactionTable />
                </div>
                <div className="xl:col-span-1 h-full">
                    <SystemAlertCard className="flex flex-col h-full" />
                </div>
            </motion.div>
        </motion.div>
        </SensorDataProvider>
    )
}