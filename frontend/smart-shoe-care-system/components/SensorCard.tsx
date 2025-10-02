import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Progress } from "./ui/progress"
import { Badge } from "./ui/badge"
import { SensorData } from "@/data/SensorData"

const SensorCard = ({ id }: { id: keyof typeof SensorData }) => {
  const sensor = SensorData[id]
  const Icon = sensor.icon
  
  const getBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "normal":
        return "bg-green-100 text-green-800 border-green-200"
      case "active":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "critical":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return ""
    }
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${sensor.color}`} />
          <CardTitle className="text-sm">{sensor.name}</CardTitle>
        </div>
        <Badge variant="outline" className={getBadgeClass(sensor.status)}>{sensor.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-semibold">{sensor.value}</span>
          <span className="text-xs text-muted-foreground">{sensor.range}</span>
        </div>
        <Progress value={sensor.percentage} className="h-3" />
      </CardContent>
    </Card>
  )
}

export default SensorCard