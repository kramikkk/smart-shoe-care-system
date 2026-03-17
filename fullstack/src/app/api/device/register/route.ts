import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { broadcastDeviceUpdate } from '@/lib/websocket'

export const dynamic = 'force-dynamic'

const DeviceRegisterSchema = z.object({
  deviceId: z.string().regex(/^SSCM-[A-F0-9]{6}$/, 'Invalid device ID format'),
  pairingCode: z.string().regex(/^\d{6}$/, 'Pairing code must be 6 digits'),
  groupToken: z.string().regex(/^[A-F0-9]{8}$/, 'GroupToken must be 8 uppercase hex chars').optional(),
})

/**
 * POST /api/device/register
 *
 * Called by ESP32 to register device and send pairing code
 *
 * Body: { deviceId: string, pairingCode: string }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (5 requests per minute per IP)
  const rateLimitResult = rateLimit(request, { maxRequests: 5, windowMs: 60000 })
  if (rateLimitResult) return rateLimitResult

  try {
    const body = await request.json()

    const validation = DeviceRegisterSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { deviceId, pairingCode, groupToken } = validation.data

    // Find existing device to check if paired
    const existingDevice = await prisma.device.findUnique({
      where: { deviceId }
    })

    // Build update payload — always store groupToken when provided
    const updateData: {
      pairingCode: string | null
      lastSeen: Date
      groupToken?: string
    } = {
      pairingCode: existingDevice?.paired ? null : pairingCode,
      lastSeen: new Date(),
    }
    if (groupToken) updateData.groupToken = groupToken

    // Upsert device with pairing code and groupToken
    const device = await prisma.device.upsert({
      where: { deviceId },
      update: updateData,
      create: {
        deviceId,
        pairingCode,
        paired: false,
        ...(groupToken ? { groupToken } : {}),
      }
    })

    // Notify kiosk of new pairing code via WebSocket
    broadcastDeviceUpdate(device.deviceId, {
      paired: device.paired,
      pairedAt: device.pairedAt,
      pairingCode: device.pairingCode,
    })

    return NextResponse.json({
      success: true,
      paired: device.paired,
      deviceId: device.deviceId,
    })
  } catch (error) {
    console.error('Device registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    )
  }
}
