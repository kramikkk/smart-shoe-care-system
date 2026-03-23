"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Loader2 } from "lucide-react"
import { useDeviceFilter } from "@/contexts/DeviceFilterContext"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ChartDataPoint = {
  date: string
  revenue: number
  transactions: number
}

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  transactions: {
    label: "Transactions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export default function AreaChartCard() {
  const { selectedDevice } = useDeviceFilter()
  const [timeRange, setTimeRange] = React.useState("7d")
  const [dataView, setDataView] = React.useState("all")
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    const fetchChartData = async () => {
      try {
        let days = 90
        if (timeRange === "30d") days = 30
        else if (timeRange === "7d") days = 7

        const response = await fetch(`/api/transaction/chart?days=${days}&deviceId=${selectedDevice}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        const data = await response.json()

        if (data.success) {
          setChartData(data.chartData)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // leave chartData empty — "No data available" state handles it
      } finally {
        setIsLoading(false)
      }
    }

    fetchChartData()
    return () => controller.abort()
  }, [timeRange, selectedDevice])

  return (
    <Card className="pt-0 h-full flex flex-col glass-card border-none overflow-hidden">
      <CardHeader className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-2 sm:space-y-0 shrink-0">
        <div className="grid flex-1 gap-1">
          <CardTitle>Transaction + Revenue Chart</CardTitle>
          <CardDescription>Daily trends</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="w-[120px] rounded-lg text-xs sm:text-sm sm:w-[130px]"
              aria-label="Select time range"
            >
              <SelectValue placeholder="Last 7 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
              <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
              <SelectItem value="90d" className="rounded-lg">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dataView} onValueChange={setDataView}>
            <SelectTrigger
              className="w-[100px] rounded-lg text-xs sm:text-sm sm:w-[130px]"
              aria-label="Select data view"
            >
              <SelectValue placeholder="Show all" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">All</SelectItem>
              <SelectItem value="revenue" className="rounded-lg">Revenue</SelectItem>
              <SelectItem value="transactions" className="rounded-lg">Transactions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[280px] sm:h-[320px] xl:h-[420px] w-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] sm:h-[320px] xl:h-[420px] w-full">
            <div className="text-muted-foreground">No data available</div>
          </div>
        ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] sm:h-[320px] xl:h-[420px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillTransactions" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-transactions)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-transactions)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={true}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            {(dataView === "revenue" || dataView === "all") && (
              <Area
                dataKey="revenue"
                type="monotone"
                fill="url(#fillRevenue)"
                stroke="var(--color-revenue)"
                fillOpacity={0.6}
              />
            )}
            {(dataView === "transactions" || dataView === "all") && (
              <Area
                dataKey="transactions"
                type="monotone"
                fill="url(#fillTransactions)"
                stroke="var(--color-transactions)"
                fillOpacity={0.6}
              />
            )}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
