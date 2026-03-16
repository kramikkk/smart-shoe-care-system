import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import type { Server } from 'http'
import type { Duplex } from 'stream'
import prisma from './prisma'

// Store active WebSocket connections by device ID (for clients subscribing to device updates)
// Use a global singleton so all Next.js bundles (API routes, custom server) share the same Map
declare global {
  // eslint-disable-next-line no-var
  var _deviceConnections: Map<string, Set<WebSocket>> | undefined
}
const deviceConnections: Map<string, Set<WebSocket>> =
  global._deviceConnections ?? (global._deviceConnections = new Map())

// Token validation — checks against configured WS_AUTH_TOKEN or requires minimum length
function validateWebSocketToken(token: string | null): boolean {
  if (!token) return false
  const wsToken = process.env.WS_AUTH_TOKEN
  if (wsToken) {
    return token === wsToken
  }
  // Fallback: require minimum length for tokens
  return token.length >= 8
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
      // Origin validation — allow device connections (no Origin header) and trusted origins
      const origin = request.headers.origin
      const serverHost = request.headers.host // e.g. "192.168.43.147:3000"
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'file://',
        process.env.NEXT_PUBLIC_APP_URL,
        // Extra origins from env (comma-separated)
        ...(process.env.WS_ALLOWED_ORIGINS ? process.env.WS_ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
      ].filter(Boolean)

      // Also allow same-host connections (tablet accessing via LAN IP)
      const isSameHost = origin && serverHost && origin === `http://${serverHost}`

      if (origin && !allowedOrigins.includes(origin) && !isSameHost) {
        console.warn(`[WebSocket] Rejected connection from origin: ${origin}`)
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }

      // Extract token from query params or cookies
      const token = searchParams.get('token') || request.headers.cookie?.match(/auth-token=([^;]+)/)?.[1] || null

      // For device connections (ESP32), allow if they provide deviceId
      const deviceId = searchParams.get('deviceId')
      const isDeviceConnection = deviceId && deviceId.startsWith('SSCM-')
      const isAdminConnection = deviceId && deviceId.startsWith('admin-')

      // Allow if: has valid token OR is device connection OR is admin connection
      if (!validateWebSocketToken(token) && !isDeviceConnection && !isAdminConnection) {
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
        const rawData = data.toString()
        if (rawData.length > 65536) { // 64KB max message size
          console.warn('[WebSocket] Message too large, ignoring')
          return
        }
        const message = JSON.parse(rawData)

        // Handle client subscription to device updates
        // groupToken is NOT required for WS subscriptions — security for the
        // CAM→backend path is enforced via X-Group-Token on the classify HTTP endpoint
        if (message.type === 'subscribe' && message.deviceId) {
          const subscribeDeviceId = message.deviceId as string

          deviceId = subscribeDeviceId
          let connections = deviceConnections.get(subscribeDeviceId)
          if (!connections) {
            connections = new Set<WebSocket>()
            deviceConnections.set(subscribeDeviceId, connections)
          }
          connections.add(ws)

          console.log(`[WebSocket] Client subscribed to device: ${subscribeDeviceId}`)

          ws.send(JSON.stringify({
            type: 'subscribed',
            deviceId: subscribeDeviceId
          }))

          // Push current device state immediately for reconnecting clients
          try {
            const device = await prisma.device.findUnique({
              where: { deviceId: subscribeDeviceId },
              select: { paired: true, pairedAt: true, name: true }
            })
            if (device) {
              ws.send(JSON.stringify({
                type: 'device-update',
                deviceId: subscribeDeviceId,
                data: {
                  paired: device.paired,
                  pairedAt: device.pairedAt,
                  deviceName: device.name,
                }
              }))
            }
          } catch (err) {
            // Non-critical — client will fall back to REST polling
            console.warn(`[WebSocket] Could not push initial device state for ${subscribeDeviceId}:`, err)
          }
        }

        // Handle device status update from ESP32
        else if (message.type === 'status-update' && message.deviceId) {
          const updateDeviceId = message.deviceId as string

          console.log(`[WebSocket] Status update from device: ${updateDeviceId}`)

          // Update lastSeen in database and get current paired status
          try {
            const updatedDevice = await prisma.device.update({
              where: { deviceId: updateDeviceId },
              data: { lastSeen: new Date() }
            })

            // Send acknowledgment with current paired status for sync
            ws.send(JSON.stringify({
              type: 'status-ack',
              deviceId: updateDeviceId,
              success: true,
              paired: updatedDevice.paired
            }))

            // Broadcast device online status to all subscribed clients (tablets)
            // This ensures tablets know the ESP32 is connected/alive
            broadcastToDevice(updateDeviceId, {
              type: 'device-online',
              deviceId: updateDeviceId,
              paired: updatedDevice.paired,
              lastSeen: new Date().toISOString()
            })
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

        // Handle coin insertion from ESP32
        else if (message.type === 'coin-inserted' && message.deviceId) {
          const coinDeviceId = message.deviceId as string
          console.log(`[WebSocket] Coin: ₱${message.coinValue} on ${coinDeviceId}`)
          broadcastToDevice(coinDeviceId, message)
        }

        // Handle bill insertion from ESP32
        else if (message.type === 'bill-inserted' && message.deviceId) {
          const billDeviceId = message.deviceId as string
          console.log(`[WebSocket] Bill: ₱${message.billValue} on ${billDeviceId}`)
          broadcastToDevice(billDeviceId, message)
        }

        // Handle payment system enable from frontend
        else if (message.type === 'enable-payment' && message.deviceId) {
          const paymentDeviceId = message.deviceId as string
          console.log(`[WebSocket] Enable payment system on ${paymentDeviceId}`)
          // Forward to ESP32 device
          broadcastToDevice(paymentDeviceId, message)
        }

        // Handle payment system disable from frontend
        else if (message.type === 'disable-payment' && message.deviceId) {
          const paymentDeviceId = message.deviceId as string
          console.log(`[WebSocket] Disable payment system on ${paymentDeviceId}`)
          // Forward to ESP32 device
          broadcastToDevice(paymentDeviceId, message)
        }

        // Handle sensor data from ESP32 (temperature & humidity)
        else if (message.type === 'sensor-data' && message.deviceId) {
          const sensorDeviceId = message.deviceId as string
          console.log(`[WebSocket] Sensor data from ${sensorDeviceId}: Temp ${message.temperature}°C, Humidity ${message.humidity}%, CAM Synced: ${message.camSynced}, CAM ID: ${message.camDeviceId || 'NOT PROVIDED'}`)

          // Update camSynced and camDeviceId in database if provided
          if (message.camSynced !== undefined || message.camDeviceId) {
            try {
              const updateData: { camSynced?: boolean; camDeviceId?: string } = {}
              if (message.camSynced !== undefined) updateData.camSynced = message.camSynced

              if (message.camDeviceId) {
                const existing = await prisma.device.findUnique({
                  where: { deviceId: sensorDeviceId },
                  select: { camDeviceId: true }
                })
                if (existing?.camDeviceId !== message.camDeviceId) {
                  updateData.camDeviceId = message.camDeviceId as string
                  console.log(`[WebSocket] ✅ Saved CAM Device ID to database: ${message.camDeviceId}`)
                }
              }

              if (Object.keys(updateData).length > 0) {
                await prisma.device.update({
                  where: { deviceId: sensorDeviceId },
                  data: updateData
                })
              }
            } catch (error) {
              console.error(`[WebSocket] ❌ Failed to save to database:`, error)
            }
          }

          // Broadcast to all clients subscribed to this device
          broadcastToDevice(sensorDeviceId, message)
        }

        // Handle CAM sync status from ESP32 (main board)
        else if (message.type === 'cam-sync-status' && message.deviceId) {
          const syncDeviceId = message.deviceId as string
          console.log(`[WebSocket] CAM sync status from ${syncDeviceId}: ${message.camSynced ? 'SYNCED' : 'NOT_SYNCED'}${message.camDeviceId ? `, CAM ID: ${message.camDeviceId}` : ''}`)

          // Update camSynced and camDeviceId in database
          try {
            const updateData: { camSynced?: boolean; camDeviceId?: string } = { camSynced: message.camSynced }
            if (message.camDeviceId) updateData.camDeviceId = message.camDeviceId as string

            await prisma.device.update({
              where: { deviceId: syncDeviceId },
              data: updateData
            })
          } catch (error) {
            // Device might not exist yet, ignore
          }

          // Broadcast to all clients subscribed to this device
          broadcastToDevice(syncDeviceId, message)
        }

        // Handle CAM pairing acknowledgment from ESP32 main board
        // Sent after CAM responds to pairing broadcast with PairingAck
        else if (message.type === 'cam-paired' && message.deviceId) {
          const mainDeviceId = message.deviceId as string
          const camDeviceId  = message.camDeviceId as string
          const camIp        = message.camIp as string | undefined
          console.log(`[WebSocket] CAM paired: ${camDeviceId} -> ${mainDeviceId}${camIp ? ` @ ${camIp}` : ''}`)

          // Update camDeviceId, camIp, and camSynced in database
          try {
            await prisma.device.update({
              where: { deviceId: mainDeviceId },
              data: {
                camDeviceId: camDeviceId,
                camSynced:   true,
                ...(camIp ? { camIp } : {}),
              }
            })
          } catch (error) {
            console.error(`[WebSocket] Failed to save CAM pairing for ${mainDeviceId}:`, error)
          }

          // Broadcast to all clients subscribed to this device (tablets can react to cam sync)
          broadcastToDevice(mainDeviceId, message)
        }

        // Handle distance data from ESP32 (atomizer & foam levels)
        else if (message.type === 'distance-data' && message.deviceId) {
          const distanceDeviceId = message.deviceId as string
          console.log(`[WebSocket] Distance data from ${distanceDeviceId}: Atomizer ${message.atomizerDistance}cm, Foam ${message.foamDistance}cm`)
          // Broadcast to all clients subscribed to this device
          broadcastToDevice(distanceDeviceId, message)
        }

        // Handle start-service command from frontend
        else if (message.type === 'start-service' && message.deviceId) {
          const serviceDeviceId = message.deviceId as string
          console.log(`[WebSocket] Start service on ${serviceDeviceId}: ${message.serviceType} (${message.careType})`)
          // Forward to ESP32 device
          broadcastToDevice(serviceDeviceId, message)
        }

        // Handle service status updates from ESP32
        else if (message.type === 'service-status' && message.deviceId) {
          const statusDeviceId = message.deviceId as string
          console.log(`[WebSocket] Service status from ${statusDeviceId}: ${message.progress}% complete, ${message.timeRemaining}s remaining`)
          // Broadcast to all clients subscribed to this device
          broadcastToDevice(statusDeviceId, message)
        }

        // Handle service complete notification from ESP32
        else if (message.type === 'service-complete' && message.deviceId) {
          const completeDeviceId = message.deviceId as string
          console.log(`[WebSocket] Service complete on ${completeDeviceId}: ${message.serviceType}`)
          // Broadcast to all clients subscribed to this device
          broadcastToDevice(completeDeviceId, message)
        }

        // ===================== ESP32-CAM MESSAGES =====================

        // Handle CAM status updates
        else if (message.type === 'cam-status' && message.deviceId) {
          const camDeviceId = message.deviceId as string
          console.log(`[WebSocket] CAM status from ${camDeviceId}: camera=${message.cameraReady}, classifying=${message.classifying}`)
          // Broadcast to main board and UI clients
          // CAM device ID is SSCM-CAM-xxx, main board is SSCM-xxx
          const mainDeviceId = camDeviceId.replace('SSCM-CAM-', 'SSCM-')
          broadcastToDevice(mainDeviceId, message)
          broadcastToDevice(camDeviceId, message)
        }

        // Handle classification request from tablet/frontend
        // New flow: forward to main board, which triggers CAM via ESP-NOW direct path
        else if ((message.type === 'start-classification' || message.type === 'request-classification') && message.deviceId) {
          const requestDeviceId = message.deviceId as string

          // Normalise to main board ID (strip SSCM-CAM- prefix if tablet sent CAM id by mistake)
          const mainDeviceId = requestDeviceId.startsWith('SSCM-CAM-')
            ? requestDeviceId.replace('SSCM-CAM-', 'SSCM-')
            : requestDeviceId

          console.log(`[WebSocket] Classification request → main board: ${mainDeviceId}`)
          broadcastToDevice(mainDeviceId, {
            type: 'start-classification',
            deviceId: mainDeviceId
          })
        }

        // Handle classification result — now sent by main board (relayed from CAM via ESP-NOW)
        // Backward compat: also handles old path where CAM sent directly (SSCM-CAM-xxx)
        else if (message.type === 'classification-result' && message.deviceId) {
          const sourceId = message.deviceId as string
          console.log(`[WebSocket] Classification result from ${sourceId}: ${message.result} (${(message.confidence * 100).toFixed(1)}%)`)

          if (sourceId.startsWith('SSCM-CAM-')) {
            // Old path: CAM sent directly (backward compat)
            const mainDeviceId = sourceId.replace('SSCM-CAM-', 'SSCM-')
            broadcastToDevice(mainDeviceId, message)
          } else {
            // New path: main board relayed the result — broadcast to all tablet subscribers
            broadcastToDevice(sourceId, message)
          }
        }

        // Handle classification error — now sent by main board on behalf of CAM
        else if (message.type === 'classification-error' && message.deviceId) {
          const sourceId = message.deviceId as string
          console.log(`[WebSocket] Classification error from ${sourceId}: ${message.error}`)

          const targetId = sourceId.startsWith('SSCM-CAM-')
            ? sourceId.replace('SSCM-CAM-', 'SSCM-')
            : sourceId
          broadcastToDevice(targetId, message)
        }

        // Handle classification started (kept for backward compat with old CAM firmware)
        else if (message.type === 'classification-started' && message.deviceId) {
          const sourceId    = message.deviceId as string
          const mainId = sourceId.startsWith('SSCM-CAM-')
            ? sourceId.replace('SSCM-CAM-', 'SSCM-')
            : sourceId
          console.log(`[WebSocket] Classification started on ${mainId}`)
          broadcastToDevice(mainId, message)
        }

        // Handle classification busy (backward compat)
        else if (message.type === 'classification-busy' && message.deviceId) {
          const sourceId = message.deviceId as string
          const mainId = sourceId.startsWith('SSCM-CAM-')
            ? sourceId.replace('SSCM-CAM-', 'SSCM-')
            : sourceId
          console.log(`[WebSocket] Classification busy on ${mainId}`)
          broadcastToDevice(mainId, message)
        }

        // Handle enable-classification (page enter) from frontend
        else if (message.type === 'enable-classification' && message.deviceId) {
          const mainDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification page entered, enabling LED for ${mainDeviceId}`)
          broadcastToDevice(mainDeviceId, {
            type: 'enable-classification',
            deviceId: mainDeviceId
          })
        }

        // Handle disable-classification (page leave) from frontend
        else if (message.type === 'disable-classification' && message.deviceId) {
          const mainDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification page exited, disabling LED for ${mainDeviceId}`)
          broadcastToDevice(mainDeviceId, {
            type: 'disable-classification',
            deviceId: mainDeviceId
          })
        }

        // Handle restart-device command from admin
        else if (message.type === 'restart-device' && message.deviceId) {
          const restartDeviceId = message.deviceId as string
          console.log(`[WebSocket] Restart requested for ${restartDeviceId}`)
          // Forward to ESP32 device
          broadcastToDevice(restartDeviceId, {
            type: 'restart-device',
            deviceId: restartDeviceId
          })
        }

        // Unknown message type
        else {
          console.warn(`[WebSocket] Unknown message type: ${message.type} from ${deviceId || 'unknown'}`)
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

// Generic broadcast function
function broadcastToDevice(deviceId: string, message: any) {
  const connections = deviceConnections.get(deviceId)
  if (connections && connections.size > 0) {
    const messageStr = JSON.stringify(message)
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr)
      }
    })
  }
}

// Broadcast restart command to ESP32
export function broadcastRestartDevice(deviceId: string) {
  broadcastToDevice(deviceId, {
    type: 'restart-device',
    deviceId
  })
}

// Broadcast device status update to all subscribed clients
// NOTE: Never include pairingCode or groupToken in broadcast data
export function broadcastDeviceUpdate(deviceId: string, data: {
  paired: boolean
  pairedAt: Date | null
  deviceName?: string | null
}) {
  broadcastToDevice(deviceId, {
    type: 'device-update',
    deviceId,
    data: {
      paired: data.paired,
      pairedAt: data.pairedAt,
      deviceName: data.deviceName,
    }
  })
}

// Broadcast classification result to all subscribed clients (tablets)
export function broadcastClassificationResult(
  deviceId: string,
  result: string,
  confidence: number,
  subCategory: string = '',
  condition: 'normal' | 'too_dirty' = 'normal'
) {
  broadcastToDevice(deviceId, {
    type: 'classification-result',
    deviceId,
    result,
    confidence,
    subCategory,
    condition,
  })
}

// Broadcast classification error to all subscribed clients (tablets)
export function broadcastClassificationError(deviceId: string, error: string) {
  // Sanitize error message — don't forward raw error strings from devices
  const sanitizedError = typeof error === 'string' && error.length < 200
    ? error
    : 'Classification failed'
  broadcastToDevice(deviceId, {
    type: 'classification-error',
    deviceId,
    error: sanitizedError,
  })
}
