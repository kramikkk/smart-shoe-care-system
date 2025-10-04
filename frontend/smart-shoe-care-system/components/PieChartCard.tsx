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

const serviceData = [
  { type: "cleaning", service: 46, fill: "var(--color-cleaning)" },
  { type: "drying", service: 27, fill: "var(--color-drying)" },
  { type: "sterilizing", service: 34, fill: "var(--color-sterilizing)" },
  { type: "all", service: 23, fill: "var(--color-all)" },
]

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
  all: {
    label: "All",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function PieChartCard() {
  const id = "pie-interactive"
  const [activeService, setActiveService] = React.useState(serviceData[0].type)

  const activeIndex = React.useMemo(
    () => serviceData.findIndex((item) => item.type === activeService),
    [activeService]
  )
  const services = React.useMemo(() => serviceData.map((item) => item.type), [])

  return (
    <Card data-chart={id} className="flex flex-col">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <div className="grid gap-1">
          <CardTitle>Service Type Distribution</CardTitle>
          <CardDescription>Monthly</CardDescription>
        </div>
        <Select value={activeService} onValueChange={setActiveService}>
          <SelectTrigger
            className="ml-auto h-7 w-[130px] rounded-lg pl-2.5"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {services.map((key) => {
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
      <CardContent className="flex flex-1 justify-center pb-0">
        <ChartContainer
          id={id}
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
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
