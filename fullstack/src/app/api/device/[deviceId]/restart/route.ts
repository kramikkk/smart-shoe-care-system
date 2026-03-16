import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/device/[deviceId]/restart
 *
 * Sends a restart command to the device via WebSocket
 * This endpoint is called from the admin panel
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

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      )
    }

    // Verify device ownership
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { pairedBy: true }
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    if (device.pairedBy !== session.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to restart this device' },
        { status: 403 }
      )
    }

    // The actual restart command is sent via WebSocket from the client
    // This endpoint just validates the request and returns success
    // The frontend will send the WebSocket message directly

    return NextResponse.json({
      success: true,
      message: `Restart command acknowledged for device ${deviceId}`,
      deviceId
    })
  } catch (error) {
    console.error('Device restart error:', error)
    return NextResponse.json(
      { error: 'Failed to send restart command' },
      { status: 500 }
    )
  }
}
