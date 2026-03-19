import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { deviceId } = await params
    const { name } = await req.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    if (name.trim().length > 64) {
      return NextResponse.json({ error: 'Name must be 64 characters or fewer' }, { status: 400 })
    }

    const device = await prisma.device.findUnique({ where: { deviceId } })
    if (!device || device.pairedBy !== session.user.id) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    await prisma.device.update({
      where: { deviceId },
      data: { name: name.trim() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating device name:', error)
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 })
  }
}
