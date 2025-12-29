'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type DeviceFilterContextType = {
  selectedDevice: string // deviceId
  setSelectedDevice: (deviceId: string) => void
  devices: Array<{ deviceId: string }>
  isLoading: boolean
  refreshDevices: () => Promise<void>
}

const DeviceFilterContext = createContext<DeviceFilterContextType | undefined>(undefined)

export function DeviceFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [devices, setDevices] = useState<Array<{ deviceId: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/device/list')
      const data = await response.json()

      if (data.success) {
        const deviceList = data.devices
          .filter((device: any) => device.paired) // Only show paired devices
          .map((device: any) => ({
            deviceId: device.deviceId,
          }))
        setDevices(deviceList)

        // Auto-select first device if not already selected
        if (deviceList.length > 0 && !selectedDevice) {
          setSelectedDevice(deviceList[0].deviceId)
        }
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const refreshDevices = async () => {
    setIsLoading(true)
    await fetchDevices()
  }

  return (
    <DeviceFilterContext.Provider
      value={{
        selectedDevice,
        setSelectedDevice,
        devices,
        isLoading,
        refreshDevices
      }}
    >
      {children}
    </DeviceFilterContext.Provider>
  )
}

export function useDeviceFilter() {
  const context = useContext(DeviceFilterContext)
  if (context === undefined) {
    throw new Error('useDeviceFilter must be used within a DeviceFilterProvider')
  }
  return context
}
