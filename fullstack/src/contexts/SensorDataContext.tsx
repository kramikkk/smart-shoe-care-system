'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useDeviceFilter } from './DeviceFilterContext'

type SensorData = {
  temperature: number
  humidity: number
  atomizerDistance: number
  foamDistance: number
  lastUpdate: Date | null
}

type SensorDataContextType = {
  sensorData: SensorData
  isConnected: boolean
}

const SensorDataContext = createContext<SensorDataContextType | undefined>(undefined)

export function SensorDataProvider({ children }: { children: React.ReactNode }) {
  const { selectedDevice } = useDeviceFilter()
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    atomizerDistance: 0,
    foamDistance: 0,
    lastUpdate: null
  })
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!selectedDevice) {
      console.log('[SensorData] No device selected, skipping WebSocket connection')
      return
    }

    console.log(`[SensorData] Connecting to device: ${selectedDevice}`)

    // Create WebSocket connection with deviceId parameter (similar to payment page)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/ws?deviceId=${encodeURIComponent(selectedDevice)}`
    
    let ws: WebSocket
    let reconnectTimeout: NodeJS.Timeout

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[SensorData] WebSocket connected')
        setIsConnected(true)

        // Subscribe to device updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          deviceId: selectedDevice
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          // Handle sensor data (temperature & humidity)
          if (message.type === 'sensor-data') {
            console.log('[SensorData] Received sensor data:', message)
            setSensorData(prev => ({
              ...prev,
              temperature: message.temperature || prev.temperature,
              humidity: message.humidity || prev.humidity,
              lastUpdate: new Date()
            }))
          }

          // Handle distance data (atomizer & foam levels)
          if (message.type === 'distance-data') {
            console.log('[SensorData] Received distance data:', message)
            setSensorData(prev => ({
              ...prev,
              atomizerDistance: message.atomizerDistance || prev.atomizerDistance,
              foamDistance: message.foamDistance || prev.foamDistance,
              lastUpdate: new Date()
            }))
          }
        } catch (error) {
          console.error('[SensorData] Error parsing message:', error)
        }
      }

      ws.onerror = (error) => {
        console.warn('[SensorData] WebSocket connection error (this is normal if reconnecting)')
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log('[SensorData] WebSocket disconnected, will retry in 5 seconds')
        setIsConnected(false)
        
        // Auto-reconnect after 5 seconds
        reconnectTimeout = setTimeout(() => {
          console.log('[SensorData] Attempting to reconnect...')
          connect()
        }, 5000)
      }
    }

    connect()

    // Cleanup on unmount or device change
    return () => {
      clearTimeout(reconnectTimeout)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    }
  }, [selectedDevice])

  return (
    <SensorDataContext.Provider value={{ sensorData, isConnected }}>
      {children}
    </SensorDataContext.Provider>
  )
}

export function useSensorData() {
  const context = useContext(SensorDataContext)
  if (context === undefined) {
    throw new Error('useSensorData must be used within a SensorDataProvider')
  }
  return context
}
