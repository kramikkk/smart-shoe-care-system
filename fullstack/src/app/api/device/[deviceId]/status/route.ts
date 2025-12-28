import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/device/[deviceId]/status
 *
 * Called by ESP32 to check if it's paired and update lastSeen
 *
 * Returns device pairing status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Find device (don't auto-create to prevent ghost devices)
    let device = await prisma.device.findUnique({
      where: { deviceId }
    })

    if (!device) {
      // Device doesn't exist - return 404
      // Only /api/device/register should create devices
      return NextResponse.json(
        { error: 'Device not found. Please register via /api/device/register first.' },
        { status: 404 }
      )
    }

    // Update lastSeen timestamp
    await prisma.device.update({
      where: { deviceId },
      data: { lastSeen: new Date() }
    })

    // Return status
    return NextResponse.json({
      paired: device.paired,
      deviceId: device.deviceId,
      pairingCode: device.pairingCode,
      pairedAt: device.pairedAt,
    })
  } catch (error) {
    console.error('Device status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check device status' },
      { status: 500 }
    )
  }
}
