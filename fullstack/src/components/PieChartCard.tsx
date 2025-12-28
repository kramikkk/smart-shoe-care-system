"use client"

import * as React from "react"
import { Label, Pie, PieChart, Sector } from "recharts"
import { PieSectorDataItem } from "recharts/types/polar/Pie"

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
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ServiceData = {
  type: string
  service: number
  revenue: number
  fill: string
}

const chartConfig = {
  service: {
    label: "Service",
  },
  cleaning: {
    label: "Cleaning",
    color: "var(--chart-1)",
  },
  drying: {
    label: "Drying",
    color: "var(--chart-2)",
  },
  sterilizing: {
    label: "Sterilizing",
    color: "var(--chart-3)",
  },
  package: {
    label: "Package",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function PieChartCard() {
  const id = "pie-interactive"
  const [serviceData, setServiceData] = React.useState<ServiceData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeService, setActiveService] = React.useState("")

  // Fetch service distribution data
  React.useEffect(() => {
    const fetchDistribution = async () => {
      try {
        const response = await fetch('/api/transaction/distribution')
        const data = await response.json()

        if (data.success) {
          if (data.serviceData.length > 0) {
            setServiceData(data.serviceData)
            setActiveService(data.serviceData[0].type)
          } else {
            // No transactions yet - this is normal for a fresh database
            setServiceData([])
          }
        } else {
          console.error('Failed to fetch distribution:', data.error || 'Unknown error')
        }
      } catch (error) {
        console.error('Error fetching distribution:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDistribution()
  }, [])

  const activeIndex = React.useMemo(
    () => serviceData.findIndex((item: ServiceData) => item.type === activeService),
    [activeService, serviceData]
  )
  const services = React.useMemo(() => serviceData.map((item: ServiceData) => item.type), [serviceData])

  const totalServices = React.useMemo(
    () => serviceData.reduce((acc: number, curr: ServiceData) => acc + curr.service, 0),
    [serviceData]
  )

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full min-h-[400px]">
        <CardHeader>
          <CardTitle>Service Type Distribution</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 justify-center items-center">
          <div className="text-muted-foreground">Loading chart data...</div>
        </CardContent>
      </Card>
    )
  }

  if (serviceData.length === 0) {
    return (
      <Card className="flex flex-col h-full min-h-[400px]">
        <CardHeader>
          <CardTitle>Service Type Distribution</CardTitle>
          <CardDescription>No data</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 justify-center items-center">
          <div className="text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-chart={id} className="flex flex-col h-full min-h-[400px]">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <div className="grid gap-1">
          <CardTitle>Service Type Distribution</CardTitle>
          <CardDescription>Daily</CardDescription>
        </div>
        <Select value={activeService} onValueChange={setActiveService}>
          <SelectTrigger
            className="ml-auto h-7 w-[130px] rounded-lg pl-2.5"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {services.map((key: string) => {
              const config = chartConfig[key as keyof typeof chartConfig]

              if (!config) {
                return null
              }

              return (
                <SelectItem
                  key={key}
                  value={key}
                  className="rounded-lg [&_span]:flex"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-xs"
                      style={{
                        backgroundColor: `var(--color-${key})`,
                      }}
                    />
                    {config?.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-1 justify-center items-center pb-4">
        <ChartContainer
          id={id}
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[400px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const data = payload[0].payload
                const percentage = ((data.service / totalServices) * 100).toFixed(1)
                const formattedRevenue = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "PHP",
                }).format(data.revenue)
                
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: data.fill }}
                          />
                          <span className="text-sm font-medium capitalize">
                            {chartConfig[data.type as keyof typeof chartConfig]?.label}
                          </span>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-xs text-muted-foreground">Services:</span>
                          <span className="text-sm font-bold">{data.service}</span>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-xs text-muted-foreground">Percentage:</span>
                          <span className="text-sm font-bold">{percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-xs text-muted-foreground">Revenue:</span>
                          <span className="text-sm font-bold">{formattedRevenue}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Pie
              data={serviceData}
              dataKey="service"
              nameKey="type"
              innerRadius={60}
              strokeWidth={5}
              activeIndex={activeIndex}
              activeShape={({
                outerRadius = 0,
                ...props
              }: PieSectorDataItem) => (
                <g>
                  <Sector {...props} outerRadius={outerRadius + 10} />
                  <Sector
                    {...props}
                    outerRadius={outerRadius + 25}
                    innerRadius={outerRadius + 12}
                  />
                </g>
              )}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {serviceData[activeIndex].service.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Bought
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
            <ChartLegend 
                content={<ChartLegendContent nameKey="type"/>}
                />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
