'use client'

import { AlertCircle, AlertTriangle, Bell, Info, WifiOff } from "lucide-react"
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
import { useSensorData } from "@/contexts/SensorDataContext"
import { Badge } from "./ui/badge"

type Alert = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
}

const MIN_DIST = 2
const MAX_DIST = 21
const TANK_MAX_LITERS = 8

function distanceToPercent(distance: number): number {
  if (distance <= 0) return 0
  const d = Math.min(Math.max(distance, MIN_DIST), MAX_DIST)
  return ((MAX_DIST - d) / (MAX_DIST - MIN_DIST)) * 100
}

function distanceToLiters(distance: number): number {
  return (distanceToPercent(distance) / 100) * TANK_MAX_LITERS
}

function deriveAlerts(sensorData: ReturnType<typeof useSensorData>['sensorData'], isConnected: boolean): Alert[] {
  const alerts: Alert[] = []

  if (!isConnected) {
    alerts.push({
      id: 'device-offline',
      severity: 'critical',
      title: 'Device Offline',
      description: 'The machine is not connected. Check network and power.',
    })
    return alerts // No point checking sensors if device is offline
  }

  if (!sensorData.camSynced) {
    alerts.push({
      id: 'cam-not-synced',
      severity: 'warning',
      title: 'Camera Not Synced',
      description: 'ESP32-CAM is not paired with the main board. Classification will not work.',
    })
  }

  const atomizerPct = distanceToPercent(sensorData.atomizerDistance)
  const atomizerL = distanceToLiters(sensorData.atomizerDistance)
  if (sensorData.atomizerDistance > 0) {
    if (atomizerPct < 20) {
      alerts.push({
        id: 'atomizer-critical',
        severity: 'critical',
        title: 'Atomizer Water Critical',
        description: `Atomizer tank is critically low (${atomizerL.toFixed(1)}L). Refill immediately.`,
      })
    } else if (atomizerPct < 40) {
      alerts.push({
        id: 'atomizer-warning',
        severity: 'warning',
        title: 'Atomizer Water Low',
        description: `Atomizer tank is running low (${atomizerL.toFixed(1)}L). Consider refilling soon.`,
      })
    }
  }

  const foamPct = distanceToPercent(sensorData.foamDistance)
  const foamL = distanceToLiters(sensorData.foamDistance)
  if (sensorData.foamDistance > 0) {
    if (foamPct < 20) {
      alerts.push({
        id: 'foam-critical',
        severity: 'critical',
        title: 'Foam Solution Critical',
        description: `Foam solution tank is critically low (${foamL.toFixed(1)}L). Refill immediately.`,
      })
    } else if (foamPct < 40) {
      alerts.push({
        id: 'foam-warning',
        severity: 'warning',
        title: 'Foam Solution Low',
        description: `Foam solution tank is running low (${foamL.toFixed(1)}L). Consider refilling soon.`,
      })
    }
  }

  if (sensorData.temperature > 0) {
    if (sensorData.temperature > 50) {
      alerts.push({
        id: 'temp-critical',
        severity: 'critical',
        title: 'Temperature Critical',
        description: `Chamber temperature is dangerously high (${sensorData.temperature.toFixed(1)}°C). Check ventilation.`,
      })
    } else if (sensorData.temperature > 40) {
      alerts.push({
        id: 'temp-high',
        severity: 'warning',
        title: 'High Temperature',
        description: `Chamber temperature is elevated (${sensorData.temperature.toFixed(1)}°C).`,
      })
    }
  }

  if (sensorData.humidity > 0 && sensorData.humidity > 70) {
    alerts.push({
      id: 'humidity-high',
      severity: 'warning',
      title: 'High Humidity',
      description: `Chamber humidity is high (${sensorData.humidity.toFixed(1)}%). May affect drying performance.`,
    })
  }

  return alerts
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    rowClass: 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10',
    iconClass: 'text-red-500',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    rowClass: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/40 dark:bg-yellow-900/10',
    iconClass: 'text-yellow-500',
    label: 'Warning',
  },
  info: {
    icon: Info,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    rowClass: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-900/10',
    iconClass: 'text-blue-500',
    label: 'Info',
  },
}

const SystemAlertCard = () => {
  const { sensorData, isConnected } = useSensorData()
  const alerts = deriveAlerts(sensorData, isConnected)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="flex flex-col h-full">
      <Card className="@container/card flex flex-col h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className={alerts.length > 0 ? "text-red-500" : "text-muted-foreground"} />
              <CardTitle>System Alerts</CardTitle>
            </div>
            {alerts.length > 0 && (
              <div className="flex gap-2">
                {criticalCount > 0 && (
                  <Badge variant="outline" className={severityConfig.critical.badgeClass}>
                    {criticalCount} Critical
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="outline" className={severityConfig.warning.badgeClass}>
                    {warningCount} Warning
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Empty className="p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bell />
                  </EmptyMedia>
                  <EmptyTitle>No Alerts</EmptyTitle>
                  <EmptyDescription>
                    All systems are running smoothly.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const config = severityConfig[alert.severity]
                const Icon = config.icon
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${config.rowClass}`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{alert.title}</p>
                        <Badge variant="outline" className={`${config.badgeClass} text-xs h-5`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemAlertCard
