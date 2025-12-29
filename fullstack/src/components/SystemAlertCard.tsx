import { AlertCircle, Bell } from "lucide-react"
import { Card, CardContent, CardTitle } from "./ui/card"
import { CardHeader } from "./ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const SystemAlertCard = () => {
  return (
    <div className="flex flex-col h-full">
        <Card className="@container/card flex flex-col h-full">
            <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-500" />
                  <CardTitle>System Alerts</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                    <Bell />
                    </EmptyMedia>
                    <EmptyTitle>No Alerts Yet</EmptyTitle>
                    <EmptyDescription>
                    All systems are running smoothly.
                    </EmptyDescription>
                </EmptyHeader>
                </Empty>
            </CardContent>
        </Card>
    </div>
  )
}

export default SystemAlertCard