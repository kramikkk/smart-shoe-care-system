import { TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { StatsData } from "@/data/StatsData"

const StatsCard = ({ id }: { id: keyof typeof StatsData }) => {
  const stat = StatsData[id]
  const TrendIcon = stat.isPositive ? TrendingUp : TrendingDown

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{stat.title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {stat.value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendIcon className="size-4" />
            {stat.isPositive ? "+" : ""}
            {stat.trendValue}%
          </Badge>
        </CardAction>
      </CardHeader>

      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="flex gap-2 font-medium line-clamp-1">
          {stat.footerLabel}
          <TrendIcon className="size-4 shrink-0" />
        </div>
        <div className="text-muted-foreground">{stat.footerDescription}</div>
      </CardFooter>
    </Card>
  )
}

export default StatsCard
