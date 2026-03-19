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

    // Atomic pair: find unpaired device with matching code and update in one operation
    let pairedDevice
    try {
      pairedDevice = await prisma.device.update({
        where: {
          deviceId,
          paired: false,
          pairingCode: pairingCode
        },
        data: {
          paired: true,
          pairedAt: new Date(),
          pairedBy: session.user.id,
          pairingCode: null,
        }
      })
    } catch {
      // Update failed — either device not found, already paired, or wrong code
      const device = await prisma.device.findUnique({
        where: { deviceId }
      })

      if (!device) {
        return NextResponse.json(
          { error: 'Device not found' },
          { status: 404 }
        )
      }

      if (device.paired) {
        return NextResponse.json(
          { error: 'Device is already paired' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Invalid pairing code' },
        { status: 401 }
      )
    }

    // Broadcast update to all WebSocket clients subscribed to this device
    broadcastDeviceUpdate(deviceId, {
      paired: true,
      pairedAt: pairedDevice.pairedAt,
      groupToken: pairedDevice.groupToken,
    })
    console.log(`[Device] Paired: ${deviceId} by user ${session.user.id}`)

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
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    if (device.pairedBy !== session.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to unpair this device' },
        { status: 403 }
      )
    }

    // Unpair the device and clear groupToken so stale tokens don't cause mismatch on re-pair
    const unpairedDevice = await prisma.device.update({
      where: { deviceId },
      data: {
        paired: false,
        pairedAt: null,
        pairedBy: null,
        pairingCode: null, // ESP32 will generate new code on next check
        groupToken: null,  // Clear so re-pairing starts fresh
      }
    })

    // Broadcast update to all WebSocket clients subscribed to this device
    broadcastDeviceUpdate(deviceId, {
      paired: false,
      pairedAt: null,
    })
    console.log(`[Device] Unpaired: ${deviceId} by user ${session.user.id}`)

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
