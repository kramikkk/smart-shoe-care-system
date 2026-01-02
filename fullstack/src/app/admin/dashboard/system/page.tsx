'use client'

import SensCard from "@/components/SensorCard"
import SystemAlertCard from "@/components/SystemAlertCard"
import { SensorDataProvider } from "@/contexts/SensorDataContext"

export default function SystemPage() {
  return (
    <SensorDataProvider>
      <div className="flex flex-col space-y-4 h-full">
        <div>
          <SensCard id="systemStatus"/>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
          <SensCard id="temperature"/>
          <SensCard id="humidity"/>
          <SensCard id="foamLevel"/>
          <SensCard id="atomizerLevel"/>
        </div>

        <div className="flex-1 min-h-0">
          <SystemAlertCard /> 
        </div>
      </div>
    </SensorDataProvider>
  )
}