import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'
import { broadcastDeviceUpdate } from '@/lib/websocket'

/**
 * DELETE /api/admin/clients/[clientId]
 *
 * Unpairts all devices owned by the client, then deletes the account.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireAdminAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { clientId } = await params

  const user = await prisma.user.findUnique({ where: { id: clientId } })
  if (!user) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  if (user.role !== 'client') {
    return NextResponse.json({ error: 'Can only delete client accounts' }, { status: 403 })
  }

  // Fetch devices first (outside transaction — read-only)
  const devices = await prisma.device.findMany({
    where: { pairedBy: clientId },
    select: { deviceId: true },
  })

  // Unpair devices + delete user atomically
  await prisma.$transaction([
    prisma.device.updateMany({
      where: { pairedBy: clientId },
      data: {
        paired: false,
        pairedAt: null,
        pairedBy: null,
        pairingCode: null,
        groupToken: null,
      },
    }),
    // Cascade deletes sessions and accounts via onDelete: Cascade in schema
    prisma.user.delete({ where: { id: clientId } }),
  ])

  // Notify kiosks after successful commit
  for (const device of devices) {
    broadcastDeviceUpdate(device.deviceId, { paired: false, pairedAt: null })
  }

  return NextResponse.json({ success: true, unpairedDevices: devices.length })
}
