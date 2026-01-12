'use client'

import { useWebSocket } from '@/contexts/WebSocketContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link2Off } from 'lucide-react'
import { useState } from 'react'

interface PairingWrapperProps {
  children: React.ReactNode
}

export default function PairingWrapper({ children }: PairingWrapperProps) {
  const { isPaired, pairingCode, deviceId } = useWebSocket()
  const [isLoading] = useState(false) // Loading handled by context now

  // Show loading state
  if (isPaired === null || isLoading) {
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

  // Show pairing page if device is not paired
  if (isPaired === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-200 via-cyan-200 to-blue-400 p-4">
        <Card className="w-full max-w-2xl bg-white/90 border-gray-200 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative bg-orange-500/10 p-8 rounded-full border-2 border-orange-500/30">
                <Link2Off className="h-24 w-24 text-orange-400" />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
              Device Not Paired
            </CardTitle>
            <CardDescription className="text-xl text-gray-700 mt-2">
              This device needs to be paired by an administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pairing Code Display */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-3">
              <p className="text-center text-xs text-gray-600 mb-1">Pairing Code</p>
              {pairingCode ? (
                <div className="flex justify-center items-center gap-1">
                  {pairingCode.split('').map((digit, index) => (
                    <div
                      key={index}
                      className="w-10 h-12 flex items-center justify-center bg-white border-2 border-blue-300 rounded-lg shadow-sm"
                    >
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
                        {digit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500">
                  Waiting for code...
                </p>
              )}
            </div>

            {/* Device ID Display */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 text-center mb-1">Device ID</p>
              <p className="text-lg font-mono text-center text-gray-700">{deviceId}</p>
            </div>

            {/* Instructions */}
            {deviceId === 'No device configured' ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 text-center">
                  <span className="font-semibold">Setup Required:</span> This kiosk needs to be paired with a device.
                  Please register a new device from the admin panel.
                </p>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                Waiting for pairing...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Device is paired - show normal kiosk UI
  return <>{children}</>
}
