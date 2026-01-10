'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useDeviceFilter } from './DeviceFilterContext'

type SensorData = {
  temperature: number
  humidity: number
  atomizerDistance: number
  foamDistance: number
  lastUpdate: Date | null
  serviceActive: boolean
  serviceType: string
  serviceProgress: number
  serviceTimeRemaining: number
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
    lastUpdate: null,
    serviceActive: false,
    serviceType: '',
    serviceProgress: 0,
    serviceTimeRemaining: 0
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

          // Handle service status updates
          if (message.type === 'service-status') {
            console.log('[SensorData] Received service status:', message)
            setSensorData(prev => ({
              ...prev,
              serviceActive: message.active,
              serviceType: message.serviceType || '',
              serviceProgress: message.progress || 0,
              serviceTimeRemaining: message.timeRemaining || 0,
              lastUpdate: new Date()
            }))
          }

          // Handle service complete
          if (message.type === 'service-complete') {
            console.log('[SensorData] Service complete')
            setSensorData(prev => ({
              ...prev,
              serviceActive: false,
              serviceProgress: 100,
              serviceTimeRemaining: 0,
              lastUpdate: new Date()
            }))
          }

          // Handle device online notification (ESP32 connected)
          if (message.type === 'device-online') {
            console.log('[SensorData] ESP32 device is online')
            setIsConnected(true)
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
