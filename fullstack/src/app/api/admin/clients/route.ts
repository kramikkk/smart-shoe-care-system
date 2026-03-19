import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-middleware'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const clients = await prisma.user.findMany({
      where: { role: 'client' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get device counts per client
    const deviceCounts = await prisma.device.groupBy({
      by: ['pairedBy'],
      where: { pairedBy: { in: clients.map((c) => c.id) } },
      _count: { id: true },
    })

    const countMap = new Map(deviceCounts.map((d) => {
      const row = d as unknown as { pairedBy: string | null; _count: { id: number } }
      return [row.pairedBy, row._count.id]
    }))

    const result = clients.map((c) => ({
      ...c,
      deviceCount: countMap.get(c.id) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Admin] Get clients error:', err)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const { name, email, password } = body

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  let createdUserId: string | undefined
  try {
    const result = await auth.api.createUser({
      // role cast needed: Better Auth's type only knows "user"|"admin",
      // but at runtime it passes through to Prisma where 'client' is valid in our enum.
      // Without this, Better Auth injects defaultRole:"user" which fails our user_role enum.
      body: { name, email, password, role: 'client' as any },
      headers: await headers(),
    })
    createdUserId = result.user.id

    // Set role to 'client' after creation
    await prisma.user.update({
      where: { id: result.user.id },
      data: { role: 'client' },
    })

    return NextResponse.json({ ...result, user: { ...result.user, role: 'client' } }, { status: 201 })
  } catch (err: unknown) {
    // Roll back orphaned user if role update failed after creation
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
    }
    const msg = err instanceof Error ? err.message : 'Failed to create client'
    const isDuplicate = msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('email')
    if (!isDuplicate) console.error('[Admin] Create client error:', err)
    return NextResponse.json(
      { error: isDuplicate ? 'A user with that email already exists' : msg },
      { status: isDuplicate ? 409 : 500 },
    )
  }
}
