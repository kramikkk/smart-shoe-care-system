'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  [key: string]: any
}

interface WebSocketContextType {
  isConnected: boolean
  isPaired: boolean | null
  pairingCode: string
  deviceId: string
  sendMessage: (message: WebSocketMessage) => void
  subscribe: (deviceId: string) => void
  onMessage: (handler: (message: WebSocketMessage) => void) => () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

// WebSocket connection states
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

const DEVICE_ID_KEY = 'kiosk_device_id'
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 3000

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isPaired, setIsPaired] = useState<boolean | null>(null)
  const [pairingCode, setPairingCode] = useState<string>('')
  const [deviceId, setDeviceId] = useState<string>('')
  
  const wsRef = useRef<WebSocket | null>(null)
  const connectionStateRef = useRef<ConnectionState>(ConnectionState.DISCONNECTED)
  const reconnectAttemptsRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intentionalCloseRef = useRef<boolean>(false)
  const messageHandlersRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set())

  const connectWebSocket = useCallback((devId: string) => {
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
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws?deviceId=${encodeURIComponent(devId)}`

    console.log(`[WebSocket] ${connectionStateRef.current === ConnectionState.RECONNECTING ? 'Reconnecting' : 'Connecting'} to ${wsUrl}`)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully')
      connectionStateRef.current = ConnectionState.CONNECTED
      setIsConnected(true)
      reconnectAttemptsRef.current = 0

      // Subscribe to device updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        deviceId: devId
      }))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        // Handle pairing-specific messages
        if (message.type === 'subscribed') {
          console.log(`[WebSocket] Subscribed to device: ${message.deviceId}`)
        } else if (message.type === 'device-update') {
          console.log('[WebSocket] Received device update:', message.data)
          setIsPaired(message.data.paired)
          setPairingCode(message.data.pairingCode || '')
        } else if (message.type === 'device-online') {
          console.log('[WebSocket] Device is online:', message.deviceId)
          setIsPaired(message.paired)
        }

        // Notify all registered message handlers
        messageHandlersRef.current.forEach(handler => handler(message))
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error)
      }
    }

    ws.onerror = () => {
      console.error('[WebSocket] Connection error')
      connectionStateRef.current = ConnectionState.DISCONNECTED
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      connectionStateRef.current = ConnectionState.DISCONNECTED
      setIsConnected(false)

      // Don't reconnect if close was intentional
      if (intentionalCloseRef.current) {
        console.log('[WebSocket] Disconnected (intentional)')
        return
      }

      console.log(`[WebSocket] Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`)

      // Attempt to reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1)
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(devId)
        }, delay)
      } else {
        console.log('[WebSocket] Max reconnection attempts reached')
      }
    }
  }, [])

  // Initial setup
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
      }
    }

    checkInitialStatus()

    // Cleanup on unmount
    return () => {
      intentionalCloseRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connectWebSocket])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[WebSocket] Cannot send message, not connected')
    }
  }, [])

  const subscribe = useCallback((targetDeviceId: string) => {
    sendMessage({ type: 'subscribe', deviceId: targetDeviceId })
  }, [sendMessage])

  const onMessage = useCallback((handler: (message: WebSocketMessage) => void) => {
    messageHandlersRef.current.add(handler)
    return () => {
      messageHandlersRef.current.delete(handler)
    }
  }, [])

  const value: WebSocketContextType = {
    isConnected,
    isPaired,
    pairingCode,
    deviceId,
    sendMessage,
    subscribe,
    onMessage
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
