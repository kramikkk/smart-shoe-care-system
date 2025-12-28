'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link2Off } from 'lucide-react'

interface PairingWrapperProps {
  children: React.ReactNode
}

const DEVICE_ID_KEY = 'kiosk_device_id'

// WebSocket connection states
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

export default function PairingWrapper({ children }: PairingWrapperProps) {
  const [isPaired, setIsPaired] = useState<boolean | null>(null)
  const [pairingCode, setPairingCode] = useState<string>('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)
  const connectionStateRef = useRef<ConnectionState>(ConnectionState.DISCONNECTED)
  const reconnectAttemptsRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intentionalCloseRef = useRef<boolean>(false)

  // Initial check and WebSocket setup
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY)

        if (storedDeviceId) {
          const response = await fetch(`/api/device/${storedDeviceId}/status`, {
            method: 'GET',
            cache: 'no-store',
          })

          if (response.ok) {
            const data = await response.json()
            setDeviceId(data.deviceId)
            setIsPaired(data.paired)
            setPairingCode(data.pairingCode || '')

            // Connect to WebSocket for real-time updates
            connectWebSocket(data.deviceId)
          } else if (response.status === 404) {
            localStorage.removeItem(DEVICE_ID_KEY)
            setDeviceId('No device configured')
            setIsPaired(false)
            setPairingCode('')
          }
        } else {
          setDeviceId('No device configured')
          setIsPaired(false)
          setPairingCode('')
        }
      } catch (error) {
        console.error('Initial pairing check error:', error)
        setDeviceId('Connection error')
        setIsPaired(false)
        setPairingCode('')
      } finally {
        setIsLoading(false)
      }
    }

    const connectWebSocket = (deviceId: string) => {
      // Prevent duplicate connections
      if (connectionStateRef.current === ConnectionState.CONNECTING ||
          connectionStateRef.current === ConnectionState.CONNECTED) {
        console.log('[WebSocket] Already connected or connecting, skipping')
        return
      }

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      connectionStateRef.current = reconnectAttemptsRef.current > 0
        ? ConnectionState.RECONNECTING
        : ConnectionState.CONNECTING

      // Determine WebSocket protocol based on current protocol
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      // Add deviceId as query parameter for authentication
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws?deviceId=${encodeURIComponent(deviceId)}`

      console.log(`[WebSocket] ${connectionStateRef.current === ConnectionState.RECONNECTING ? 'Reconnecting' : 'Connecting'} to ${wsUrl}`)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected successfully')
        connectionStateRef.current = ConnectionState.CONNECTED
        reconnectAttemptsRef.current = 0 // Reset reconnect attempts on successful connection

        // Subscribe to device updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          deviceId
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'subscribed') {
            console.log(`[WebSocket] Subscribed to device: ${message.deviceId}`)
          } else if (message.type === 'device-update') {
            console.log('[WebSocket] Received device update:', message.data)

            // Update state with new device data
            setIsPaired(message.data.paired)
            setPairingCode(message.data.pairingCode || '')
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error')
        connectionStateRef.current = ConnectionState.DISCONNECTED
      }

      ws.onclose = (event) => {
        connectionStateRef.current = ConnectionState.DISCONNECTED

        // Don't reconnect if close was intentional
        if (intentionalCloseRef.current) {
          console.log('[WebSocket] Disconnected (intentional)')
          return
        }

        console.log(`[WebSocket] Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`)

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const baseDelay = 1000
        const maxDelay = 30000
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)

        reconnectAttemptsRef.current++

        console.log(`[WebSocket] Will attempt reconnection #${reconnectAttemptsRef.current} in ${delay / 1000}s`)

        reconnectTimeoutRef.current = setTimeout(() => {
          if (deviceId && !intentionalCloseRef.current) {
            connectWebSocket(deviceId)
          }
        }, delay)
      }
    }

    checkInitialStatus()

    // Cleanup WebSocket on unmount
    return () => {
      intentionalCloseRef.current = true

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      connectionStateRef.current = ConnectionState.DISCONNECTED
    }
  }, [])

  // Show loading state
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
