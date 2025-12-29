"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
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

const chartDataStatic = [
  { date: "2024-04-01", revenue: 180, transactions: 6 },
  { date: "2024-04-02", revenue: 126, transactions: 4 },
  { date: "2024-04-03", revenue: 270, transactions: 9 },
  { date: "2024-04-04", revenue: 100, transactions: 3 },
  { date: "2024-04-05", revenue: 224, transactions: 7 },
  { date: "2024-04-06", revenue: 288, transactions: 9 },
  { date: "2024-04-07", revenue: 84,  transactions: 3 },
  { date: "2024-04-08", revenue: 360, transactions: 10 },
  { date: "2024-04-09", revenue: 144, transactions: 4 },
  { date: "2024-04-10", revenue: 192, transactions: 6 },
  { date: "2024-04-11", revenue: 310, transactions: 9 },
  { date: "2024-04-12", revenue: 220, transactions: 7 },
  { date: "2024-04-13", revenue: 295, transactions: 8 },
  { date: "2024-04-14", revenue: 100, transactions: 3 },
  { date: "2024-04-15", revenue: 80,  transactions: 2 },
  { date: "2024-04-16", revenue: 210, transactions: 6 },
  { date: "2024-04-17", revenue: 352, transactions: 10 },
  { date: "2024-04-18", revenue: 280, transactions: 8 },
  { date: "2024-04-19", revenue: 126, transactions: 4 },
  { date: "2024-04-20", revenue: 160, transactions: 5 },
  { date: "2024-04-21", revenue: 210, transactions: 6 },
  { date: "2024-04-22", revenue: 168, transactions: 5 },
  { date: "2024-04-23", revenue: 184, transactions: 6 },
  { date: "2024-04-24", revenue: 280, transactions: 8 },
  { date: "2024-04-25", revenue: 240, transactions: 7 },
  { date: "2024-04-26", revenue: 75,  transactions: 2 },
  { date: "2024-04-27", revenue: 400, transactions: 10 },
  { date: "2024-04-28", revenue: 120, transactions: 3 },
  { date: "2024-04-29", revenue: 210, transactions: 6 },
  { date: "2024-04-30", revenue: 360, transactions: 9 },

  { date: "2024-05-01", revenue: 220, transactions: 6 },
  { date: "2024-05-02", revenue: 300, transactions: 9 },
  { date: "2024-05-03", revenue: 168, transactions: 5 },
  { date: "2024-05-04", revenue: 360, transactions: 9 },
  { date: "2024-05-05", revenue: 400, transactions: 10 },
  { date: "2024-05-06", revenue: 420, transactions: 10 },
  { date: "2024-05-07", revenue: 280, transactions: 8 },
  { date: "2024-05-08", revenue: 147, transactions: 4 },
  { date: "2024-05-09", revenue: 180, transactions: 5 },
  { date: "2024-05-10", revenue: 297, transactions: 8 },
  { date: "2024-05-11", revenue: 240, transactions: 7 },
  { date: "2024-05-12", revenue: 210, transactions: 6 },
  { date: "2024-05-13", revenue: 140, transactions: 4 },
  { date: "2024-05-14", revenue: 400, transactions: 10 },
  { date: "2024-05-15", revenue: 342, transactions: 9 },
  { date: "2024-05-16", revenue: 280, transactions: 8 },
  { date: "2024-05-17", revenue: 390, transactions: 10 },
  { date: "2024-05-18", revenue: 260, transactions: 7 },
  { date: "2024-05-19", revenue: 160, transactions: 5 },
  { date: "2024-05-20", revenue: 184, transactions: 5 },
  { date: "2024-05-21", revenue: 120, transactions: 3 },
  { date: "2024-05-22", revenue: 100, transactions: 3 },
  { date: "2024-05-23", revenue: 270, transactions: 7 },
  { date: "2024-05-24", revenue: 210, transactions: 6 },
  { date: "2024-05-25", revenue: 240, transactions: 7 },
  { date: "2024-05-26", revenue: 150, transactions: 4 },
  { date: "2024-05-27", revenue: 380, transactions: 10 },
  { date: "2024-05-28", revenue: 168, transactions: 5 },
  { date: "2024-05-29", revenue: 96,  transactions: 3 },
  { date: "2024-05-30", revenue: 240, transactions: 7 },
  { date: "2024-05-31", revenue: 184, transactions: 5 },

  { date: "2024-06-01", revenue: 210, transactions: 6 },
  { date: "2024-06-02", revenue: 360, transactions: 9 },
  { date: "2024-06-03", revenue: 126, transactions: 4 },
  { date: "2024-06-04", revenue: 320, transactions: 9 },
  { date: "2024-06-05", revenue: 112, transactions: 3 },
  { date: "2024-06-06", revenue: 240, transactions: 7 },
  { date: "2024-06-07", revenue: 280, transactions: 8 },
  { date: "2024-06-08", revenue: 320, transactions: 9 },
  { date: "2024-06-09", revenue: 400, transactions: 10 },
  { date: "2024-06-10", revenue: 150, transactions: 4 },
  { date: "2024-06-11", revenue: 105, transactions: 3 },
  { date: "2024-06-12", revenue: 390, transactions: 10 },
  { date: "2024-06-13", revenue: 120, transactions: 3 },
  { date: "2024-06-14", revenue: 320, transactions: 9 },
  { date: "2024-06-15", revenue: 260, transactions: 7 },
  { date: "2024-06-16", revenue: 310, transactions: 8 },
  { date: "2024-06-17", revenue: 420, transactions: 10 },
  { date: "2024-06-18", revenue: 136, transactions: 4 },
  { date: "2024-06-19", revenue: 280, transactions: 8 },
  { date: "2024-06-20", revenue: 360, transactions: 9 },
  { date: "2024-06-21", revenue: 168, transactions: 5 },
  { date: "2024-06-22", revenue: 240, transactions: 7 },
  { date: "2024-06-23", revenue: 400, transactions: 10 },
  { date: "2024-06-24", revenue: 144, transactions: 4 },
  { date: "2024-06-25", revenue: 150, transactions: 4 },
  { date: "2024-06-26", revenue: 320, transactions: 9 },
  { date: "2024-06-27", revenue: 390, transactions: 10 },
  { date: "2024-06-28", revenue: 200, transactions: 5 },
  { date: "2024-06-29", revenue: 140, transactions: 4 },
  { date: "2024-06-30", revenue: 360, transactions: 9 },
]


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

  // Fetch chart data from API
  React.useEffect(() => {
    const fetchChartData = async () => {
      try {
        let days = 90
        if (timeRange === "30d") days = 30
        else if (timeRange === "7d") days = 7

        const response = await fetch(`/api/transaction/chart?days=${days}&deviceId=${selectedDevice}`)
        const data = await response.json()

        if (data.success) {
          setChartData(data.chartData)
        } else {
          console.error('Failed to fetch chart data:', data.error)
        }
      } catch (error) {
        console.error('Error fetching chart data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChartData()
  }, [timeRange, selectedDevice])

  const filteredData = chartData

  return (
    <Card className="pt-0 h-full flex flex-col">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row shrink-0">
        <div className="grid flex-1 gap-1">
          <CardTitle>Transaction + Revenue Chart</CardTitle>
          <CardDescription>
            Daily trends
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="w-[130px] rounded-lg"
              aria-label="Select time range"
            >
              <SelectValue placeholder="Last 7 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                Last 90 days
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={dataView} onValueChange={setDataView}>
            <SelectTrigger
              className="w-[130px] rounded-lg"
              aria-label="Select data view"
            >
              <SelectValue placeholder="Show all" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">
                All
              </SelectItem>
              <SelectItem value="revenue" className="rounded-lg">
                Revenue
              </SelectItem>
              <SelectItem value="transactions" className="rounded-lg">
                Transactions
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 flex-1 flex items-center">
        {isLoading ? (
          <div className="flex items-center justify-center w-full">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center w-full">
            <div className="text-muted-foreground">No data available</div>
          </div>
        ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-full w-full"
        >
          <AreaChart data={filteredData}>
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