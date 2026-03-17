import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const [clientCount, deviceCount, onlineCount, revenueResult] = await Promise.all([
    prisma.user.count({ where: { role: 'client' } }),
    prisma.device.count(),
    prisma.device.count({
      where: { paired: true, lastSeen: { gte: fiveMinutesAgo } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'Success' },
    }),
  ])

  return NextResponse.json({
    clients: clientCount,
    devices: deviceCount,
    devicesOnline: onlineCount,
    totalRevenue: revenueResult._sum.amount ?? 0,
  })
}
