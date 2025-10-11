import { TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent
} from "@/components/ui/card"

import { StatsData } from "@/data/StatsData"

const StatsCard = ({ id }: { id: keyof typeof StatsData }) => {
  const stat = StatsData[id]
  const TrendIcon = stat.isPositive ? TrendingUp : TrendingDown
  const Icon = stat.icon

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${stat.iconColor}`} />
          <CardTitle className="text-md">{stat.title}</CardTitle>
        </div>
        <CardAction>
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1 ${
              stat.isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            <TrendIcon className="size-4" />
            {stat.isPositive ? "+" : ""}
            {stat.trendValue}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl pb-1">
          {stat.value}
        </CardTitle>
        <div 
          className={`text-sm font-medium ${
            stat.isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {stat.footerDescription}
        </div>
      </CardContent>
    </Card>
  )
}

export default StatsCard
