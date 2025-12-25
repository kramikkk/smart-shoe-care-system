'use client'

import { useEffect, useState } from 'react'
import NoWifiPage from './NoWifiPage'

interface WifiStatusWrapperProps {
  children: React.ReactNode
}

export default function WifiStatusWrapper({ children }: WifiStatusWrapperProps) {
  const [hasWifi, setHasWifi] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkWifiStatus = async () => {
    try {
      // Check if the device is reachable by trying to fetch from the API
      const deviceId = process.env.NEXT_PUBLIC_DEVICE_ID || 'SSCM-000000'
      const response = await fetch(`/api/device/${deviceId}/status`, {
        method: 'GET',
        cache: 'no-store'
      })

      if (response.ok) {
        // Device responded, so it has WiFi
        setHasWifi(true)
      } else {
        // Device not found or other error - no WiFi
        setHasWifi(false)
      }
    } catch (error) {
      // Network error - no WiFi
      console.error('WiFi status check error:', error)
      setHasWifi(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial check
    checkWifiStatus()

    // Poll every 5 seconds to detect when WiFi is connected
    const interval = setInterval(checkWifiStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-200 via-cyan-200 to-blue-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-900 text-lg font-semibold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
            Checking device status...
          </p>
        </div>
      </div>
    )
  }

  // Show NoWifiPage if device has no WiFi
  if (hasWifi === false) {
    return <NoWifiPage />
  }

  // Device has WiFi - show normal kiosk UI
  return <>{children}</>
}
