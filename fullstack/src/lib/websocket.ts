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
              paired: updatedDevice.paired,
              pairingCode: updatedDevice.pairingCode
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
              if (message.camDeviceId) updateData.camDeviceId = message.camDeviceId as string

              await prisma.device.update({
                where: { deviceId: sensorDeviceId },
                data: updateData
              })

              if (message.camDeviceId) {
                console.log(`[WebSocket] ✅ Saved CAM Device ID to database: ${message.camDeviceId}`)
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

        // Handle CAM pairing acknowledgment from ESP32 (main board)
        else if (message.type === 'cam-paired' && message.deviceId) {
          const mainDeviceId = message.deviceId as string
          const camDeviceId = message.camDeviceId as string
          console.log(`[WebSocket] CAM paired: ${camDeviceId} -> ${mainDeviceId}`)

          // Update camDeviceId and camSynced in database
          try {
            await prisma.device.update({
              where: { deviceId: mainDeviceId },
              data: {
                camDeviceId: camDeviceId,
                camSynced: true
              }
            })
          } catch (error) {
            console.error(`[WebSocket] Failed to save CAM pairing for ${mainDeviceId}:`, error)
          }

          // Broadcast to all clients subscribed to this device
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

        // Handle classification request from frontend or main board
        else if ((message.type === 'start-classification' || message.type === 'request-classification') && message.deviceId) {
          const requestDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification requested from ${requestDeviceId}`)

          // Determine CAM device ID
          let camDeviceId: string
          if (requestDeviceId.startsWith('SSCM-CAM-')) {
            camDeviceId = requestDeviceId
          } else if (message.camDeviceId) {
            camDeviceId = message.camDeviceId as string
          } else {
            // Derive from main board ID: SSCM-xxx -> SSCM-CAM-xxx
            camDeviceId = requestDeviceId.replace('SSCM-', 'SSCM-CAM-')
          }

          console.log(`[WebSocket] Forwarding classification request to CAM: ${camDeviceId}`)
          // Forward to CAM only - LED is controlled by enable/disable-classification
          broadcastToDevice(camDeviceId, {
            type: 'start-classification',
            deviceId: camDeviceId
          })
        }

        // Handle classification result from CAM
        else if (message.type === 'classification-result' && message.deviceId) {
          const camDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification result from ${camDeviceId}: ${message.result} (${(message.confidence * 100).toFixed(1)}%)`)

          // Broadcast to main board: SSCM-CAM-xxx -> SSCM-xxx
          const mainDeviceId = camDeviceId.replace('SSCM-CAM-', 'SSCM-')
          broadcastToDevice(mainDeviceId, message)

          // Also broadcast to CAM subscribers (UI)
          broadcastToDevice(camDeviceId, message)
        }

        // Handle classification started acknowledgment from CAM
        else if (message.type === 'classification-started' && message.deviceId) {
          const camDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification started on ${camDeviceId}`)
          // Broadcast to main board and UI
          const mainDeviceId = camDeviceId.replace('SSCM-CAM-', 'SSCM-')
          broadcastToDevice(mainDeviceId, message)
          broadcastToDevice(camDeviceId, message)
        }

        // Handle classification error from CAM
        else if (message.type === 'classification-error' && message.deviceId) {
          const camDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification error from ${camDeviceId}: ${message.error}`)
          // Broadcast to main board and UI
          const mainDeviceId = camDeviceId.replace('SSCM-CAM-', 'SSCM-')
          broadcastToDevice(mainDeviceId, message)
          broadcastToDevice(camDeviceId, message)
        }

        // Handle classification busy from CAM
        else if (message.type === 'classification-busy' && message.deviceId) {
          const camDeviceId = message.deviceId as string
          console.log(`[WebSocket] Classification busy on ${camDeviceId}`)
          // Broadcast to main board and UI
          const mainDeviceId = camDeviceId.replace('SSCM-CAM-', 'SSCM-')
          broadcastToDevice(mainDeviceId, message)
          broadcastToDevice(camDeviceId, message)
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

// Broadcast device status update to all subscribed clients
export function broadcastDeviceUpdate(deviceId: string, data: {
  paired: boolean
  pairingCode: string | null
  pairedAt: Date | null
}) {
  broadcastToDevice(deviceId, {
    type: 'device-update',
    deviceId,
    data
  })
}
