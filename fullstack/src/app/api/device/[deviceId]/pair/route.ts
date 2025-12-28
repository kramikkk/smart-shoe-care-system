import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { broadcastDeviceUpdate } from '@/lib/websocket'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const DevicePairSchema = z.object({
  pairingCode: z.string().regex(/^\d{6}$/, 'Pairing code must be 6 digits'),
})

/**
 * POST /api/device/[deviceId]/pair
 *
 * Called by admin panel to pair a device using the pairing code
 *
 * Body: { pairingCode: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { deviceId } = await params
    const body = await request.json()

    // Validate input
    const validation = DevicePairSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { pairingCode } = validation.data

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Find device
    const device = await prisma.device.findUnique({
      where: { deviceId }
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    // Check if already paired
    if (device.paired) {
      return NextResponse.json(
        { error: 'Device is already paired' },
        { status: 400 }
      )
    }

    // Verify pairing code
    if (device.pairingCode !== pairingCode) {
      return NextResponse.json(
        { error: 'Invalid pairing code' },
        { status: 401 }
      )
    }

    // Pair the device and track who paired it
    const pairedDevice = await prisma.device.update({
      where: { deviceId },
      data: {
        paired: true,
        pairedAt: new Date(),
        pairedBy: session.user.id, // Track which admin paired this device
        pairingCode: null, // Clear pairing code after successful pairing
      }
    })

    // Broadcast update to all WebSocket clients subscribed to this device
    broadcastDeviceUpdate(deviceId, {
      paired: true,
      pairingCode: null,
      pairedAt: pairedDevice.pairedAt
    })

    return NextResponse.json({
      success: true,
      message: 'Device paired successfully',
      deviceId: pairedDevice.deviceId,
      pairedAt: pairedDevice.pairedAt,
    })
  } catch (error) {
    console.error('Device pairing error:', error)
    return NextResponse.json(
      { error: 'Failed to pair device' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/device/[deviceId]/pair
 *
 * Called by admin panel to unpair a device
 */
export async function DELETE(
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

    // Find device
    const device = await prisma.device.findUnique({
      where: { deviceId }
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    // Unpair the device
    const unpairedDevice = await prisma.device.update({
      where: { deviceId },
      data: {
        paired: false,
        pairedAt: null,
        pairedBy: null,
        pairingCode: null, // ESP32 will generate new code on next check
      }
    })

    // Broadcast update to all WebSocket clients subscribed to this device
    broadcastDeviceUpdate(deviceId, {
      paired: false,
      pairingCode: null,
      pairedAt: null
    })

    return NextResponse.json({
      success: true,
      message: 'Device unpaired successfully',
      deviceId: unpairedDevice.deviceId,
    })
  } catch (error) {
    console.error('Device unpairing error:', error)
    return NextResponse.json(
      { error: 'Failed to unpair device' },
      { status: 500 }
    )
  }
}
