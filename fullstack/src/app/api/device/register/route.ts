import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const DeviceRegisterSchema = z.object({
  deviceId: z.string().regex(/^SSCM-[A-F0-9]{6}$/, 'Invalid device ID format'),
  pairingCode: z.string().regex(/^\d{6}$/, 'Pairing code must be 6 digits'),
})

/**
 * POST /api/device/register
 *
 * Called by ESP32 to register device and send pairing code
 *
 * Body: { deviceId: string, pairingCode: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validation = DeviceRegisterSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { deviceId, pairingCode } = validation.data

    // Find existing device to check if paired
    const existingDevice = await prisma.device.findUnique({
      where: { deviceId }
    })

    // Upsert device with pairing code
    const device = await prisma.device.upsert({
      where: { deviceId },
      update: {
        pairingCode: existingDevice?.paired ? null : pairingCode, // Only update if not paired
        lastSeen: new Date()
      },
      create: {
        deviceId,
        pairingCode,
        paired: false,
      }
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
