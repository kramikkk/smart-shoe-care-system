'use client'

import { TrendingDown, TrendingUp, ShoppingCart, Coins } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  CardContent
} from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useDeviceFilter } from "@/contexts/DeviceFilterContext"

type StatsType = 'totalRevenue' | 'totalTransactions'

interface Stats {
  totalRevenue: {
    value: number
    formatted: string
    trend: number
    isPositive: boolean
    diff: number
    diffFormatted: string
  }
  totalTransactions: {
    value: number
    trend: number
    isPositive: boolean
    diff: number
  }
}

const StatsCard = ({ id }: { id: StatsType }) => {
  const { selectedDevice } = useDeviceFilter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/transaction/stats?deviceId=${selectedDevice}`)
        const data = await response.json()

        if (data.success) {
          setStats(data.stats)
        } else {
          console.error('Failed to fetch stats:', data.error)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [selectedDevice])

  if (isLoading || !stats) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="size-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const stat = stats[id]
  const isPositive = stat.isPositive
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  const config = {
    totalRevenue: {
      title: 'Total Revenue',
      icon: Coins,
      iconColor: 'text-yellow-500',
      value: stats.totalRevenue.formatted,
      footerDescription: `${isPositive ? '+' : ''}${stats.totalRevenue.diffFormatted} from yesterday`,
    },
    totalTransactions: {
      title: 'Total Transactions',
      icon: ShoppingCart,
      iconColor: 'text-blue-500',
      value: stats.totalTransactions.value.toString(),
      footerDescription: `${isPositive ? '+' : ''}${Math.abs(stats.totalTransactions.diff)} from yesterday`,
    },
  }

  const currentConfig = config[id]
  const Icon = currentConfig.icon

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${currentConfig.iconColor}`} />
          <CardTitle className="text-md">{currentConfig.title}</CardTitle>
        </div>
        <CardAction>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            <TrendIcon className="size-4" />
            {isPositive ? "+" : ""}
            {stat.trend}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl pb-1">
          {currentConfig.value}
        </CardTitle>
        <div
          className={`text-sm font-medium ${
            isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {currentConfig.footerDescription}
        </div>
      </CardContent>
    </Card>
  )
}

export default StatsCard
