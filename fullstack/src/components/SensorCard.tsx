'use client'

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Progress } from "./ui/progress"
import { Badge } from "./ui/badge"
import { SensorData } from "@/data/SensorData"
import { useSensorData } from "@/contexts/SensorDataContext"

const SensorCard = ({ id }: { id: keyof typeof SensorData }) => {
  const sensor = SensorData[id]
  
  // Safely get sensor data - use default values if provider not available
  let sensorData, isConnected
  try {
    const context = useSensorData()
    sensorData = context.sensorData
    isConnected = context.isConnected
  } catch {
    sensorData = { temperature: 0, humidity: 0, atomizerDistance: 0, foamDistance: 0, lastUpdate: null }
    isConnected = false
  }
  
  const Icon = sensor.icon
  
  // Calculate real-time values based on sensor type
  let displayValue: string = "0"
  let displayPercentage: number = 0
  let displayStatus: string = sensor.status

  if (id === 'temperature' && sensorData.temperature > 0) {
    displayValue = `${sensorData.temperature}°C`
    // Calculate percentage (0-50°C range)
    displayPercentage = Math.min(100, (sensorData.temperature / 50) * 100)
    // Status: Normal (18-30°C), Warning (30-35°C), Critical (>35°C)
    if (sensorData.temperature > 35) {
      displayStatus = 'Critical'
    } else if (sensorData.temperature > 30) {
      displayStatus = 'Warning'
    } else {
      displayStatus = 'Normal'
    }
  }

  if (id === 'humidity' && sensorData.humidity > 0) {
    displayValue = `${sensorData.humidity}%`
    displayPercentage = sensorData.humidity
    // Status: Normal (40-70%), Warning (30-40% or 70-80%), Critical (<30% or >80%)
    if (sensorData.humidity < 30 || sensorData.humidity > 80) {
      displayStatus = 'Critical'
    } else if (sensorData.humidity < 40 || sensorData.humidity > 70) {
      displayStatus = 'Warning'
    } else {
      displayStatus = 'Normal'
    }
  }

  if (id === 'atomizerLevel') {
    // Debug: log the raw distance value
    if (sensorData.atomizerDistance !== 0) {
      console.log('[SensorCard] Atomizer distance:', sensorData.atomizerDistance)
    }
    
    // Convert distance to percentage (assuming 50cm = empty, 5cm = full)
    const maxDistance = 50 // cm (empty)
    const minDistance = 5  // cm (full)
    const level = sensorData.atomizerDistance > 0 ? Math.max(0, Math.min(100, 
      ((maxDistance - sensorData.atomizerDistance) / (maxDistance - minDistance)) * 100
    )) : 0
    displayValue = `${Math.round(level)}%`
    displayPercentage = level
    // Status: Critical (<20%), Warning (20-40%), Normal (>40%)
    if (level < 20) {
      displayStatus = 'Critical'
    } else if (level < 40) {
      displayStatus = 'Warning'
    } else {
      displayStatus = 'Normal'
    }
  }

  if (id === 'foamLevel') {
    // Debug: log the raw distance value
    if (sensorData.foamDistance !== 0) {
      console.log('[SensorCard] Foam distance:', sensorData.foamDistance)
    }

    // Convert distance to percentage (assuming 50cm = empty, 5cm = full)
    const maxDistance = 50 // cm (empty)
    const minDistance = 5  // cm (full)
    const level = sensorData.foamDistance > 0 ? Math.max(0, Math.min(100,
      ((maxDistance - sensorData.foamDistance) / (maxDistance - minDistance)) * 100
    )) : 0
    displayValue = `${Math.round(level)}%`
    displayPercentage = level
    // Status: Critical (<20%), Warning (20-40%), Normal (>40%)
    if (level < 20) {
      displayStatus = 'Critical'
    } else if (level < 40) {
      displayStatus = 'Warning'
    } else {
      displayStatus = 'Normal'
    }
  }

  if (id === 'systemStatus') {
    if (!isConnected) {
      displayValue = 'Offline'
      displayStatus = 'Critical'
      displayPercentage = 0
    } else if (sensorData.serviceActive) {
      // Format time remaining as MM:SS
      const mins = Math.floor(sensorData.serviceTimeRemaining / 60)
      const secs = sensorData.serviceTimeRemaining % 60
      displayValue = `${sensorData.serviceType.charAt(0).toUpperCase() + sensorData.serviceType.slice(1)}`
      displayPercentage = sensorData.serviceProgress
      displayStatus = 'Active'
      // Update the range to show timer
      sensor.range = `Timer: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      displayValue = 'Idle'
      displayStatus = 'Normal'
      displayPercentage = 0
      sensor.range = 'Timer: 00:00'
    }
  }

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
        <div className="flex items-center gap-2">
          {!isConnected && id !== 'systemStatus' && (
            <span className="text-xs text-muted-foreground">Offline</span>
          )}
          <Badge variant="outline" className={getBadgeClass(displayStatus)}>{displayStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold">{displayValue}</span>
          <span className="text-xs text-muted-foreground">{sensor.range}</span>
        </div>
        <Progress value={displayPercentage} className="h-3" />
      </CardContent>
    </Card>
  )
}

export default SensorCard