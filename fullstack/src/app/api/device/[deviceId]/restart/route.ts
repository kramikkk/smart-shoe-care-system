import { NextResponse } from 'next/server'

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
    const { deviceId } = await params

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
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
