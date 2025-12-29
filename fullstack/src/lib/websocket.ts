import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import type { Server } from 'http'
import type { Duplex } from 'stream'
import prisma from './prisma'

// Store active WebSocket connections by device ID (for clients subscribing to device updates)
const deviceConnections = new Map<string, Set<WebSocket>>()

// Simple token validation - in production, verify against session store
function validateWebSocketToken(token: string | null): boolean {
  if (!token) return false
  // Allow connections without strict auth for now (kiosk and ESP32)
  // In production: verify against Better Auth session store
  return token.length > 0
}

export function createWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/api/ws'
  })

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname, searchParams } = new URL(request.url || '', `http://${request.headers.host}`)

    // Only handle our custom WebSocket endpoint
    if (pathname === '/api/ws') {
      // Extract token from query params or cookies
      const token = searchParams.get('token') || request.headers.cookie?.match(/auth-token=([^;]+)/)?.[1] || null

      // For device connections (ESP32), allow if they provide deviceId
      const deviceId = searchParams.get('deviceId')
      const isDeviceConnection = deviceId && deviceId.startsWith('SSCM-')

      // Allow if: has valid token OR is device connection
      if (!validateWebSocketToken(token) && !isDeviceConnection) {
        console.log('[WebSocket] Unauthorized connection attempt')
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
    // For other paths (like /_next/webpack-hmr), don't handle them
    // Let Next.js handle its own WebSocket connections
  })

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('[WebSocket] New connection')

    let deviceId: string | null = null

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())

        // Handle client subscription to device updates
        if (message.type === 'subscribe' && message.deviceId) {
          const subscribeDeviceId = message.deviceId as string
          deviceId = subscribeDeviceId

          // Add this connection to the device's subscription list
          let connections = deviceConnections.get(subscribeDeviceId)
          if (!connections) {
            connections = new Set<WebSocket>()
            deviceConnections.set(subscribeDeviceId, connections)
          }
          connections.add(ws)

          console.log(`[WebSocket] Client subscribed to device: ${subscribeDeviceId}`)

          // Send confirmation
          ws.send(JSON.stringify({
            type: 'subscribed',
            deviceId: subscribeDeviceId
          }))
        }

        // Handle device status update from ESP32
        else if (message.type === 'status-update' && message.deviceId) {
          const updateDeviceId = message.deviceId as string

          console.log(`[WebSocket] Status update from device: ${updateDeviceId}`)

          // Update lastSeen in database
          try {
            await prisma.device.update({
              where: { deviceId: updateDeviceId },
              data: { lastSeen: new Date() }
            })

            // Send acknowledgment
            ws.send(JSON.stringify({
              type: 'status-ack',
              deviceId: updateDeviceId,
              success: true
            }))
          } catch (error) {
            console.error(`[WebSocket] Failed to update device ${updateDeviceId}:`, error)
            ws.send(JSON.stringify({
              type: 'status-ack',
              deviceId: updateDeviceId,
              success: false,
              error: 'Database update failed'
            }))
          }
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error)
      }
    })

    ws.on('close', () => {
      // Remove connection from all subscriptions
      if (deviceId) {
        const connections = deviceConnections.get(deviceId)
        if (connections) {
          connections.delete(ws)
          if (connections.size === 0) {
            deviceConnections.delete(deviceId)
          }
        }
        console.log(`[WebSocket] Client unsubscribed from device: ${deviceId}`)
      }
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error)
    })
  })

  return wss
}

// Broadcast device status update to all subscribed clients
export function broadcastDeviceUpdate(deviceId: string, data: {
  paired: boolean
  pairingCode: string | null
  pairedAt: Date | null
}) {
  const connections = deviceConnections.get(deviceId)

  if (connections && connections.size > 0) {
    const message = JSON.stringify({
      type: 'device-update',
      deviceId,
      data
    })

    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })

    console.log(`[WebSocket] Broadcasted update for device ${deviceId} to ${connections.size} client(s)`)
  }
}
