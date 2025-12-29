import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get device filter from query params
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('deviceId')

    // Build where clause with optional device filter
    const whereClause: any = {}
    if (deviceId) {
      whereClause.deviceId = deviceId
    }

    // Fetch transactions with optional device filter
    const transactions = await prisma.transaction.findMany({
      where: whereClause
    })

    // Group by service type and calculate totals
    const serviceDistribution = transactions.reduce((acc, tx) => {
      const serviceKey = tx.serviceType.toLowerCase()
      if (!acc[serviceKey]) {
        acc[serviceKey] = {
          type: serviceKey,
          service: 0,
          revenue: 0,
        }
      }
      acc[serviceKey].service += 1
      acc[serviceKey].revenue += tx.amount
      return acc
    }, {} as Record<string, { type: string; service: number; revenue: number }>)

    // Convert to array
    const serviceData = Object.values(serviceDistribution).map((item) => ({
      ...item,
      fill: `var(--color-${item.type})`,
    }))

    return NextResponse.json({
      success: true,
      serviceData,
      total: {
        transactions: transactions.length,
        revenue: transactions.reduce((sum, tx) => sum + tx.amount, 0),
      },
    })
  } catch (error: any) {
    console.error('Error fetching service distribution:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch service distribution',
      },
      { status: 500 }
    )
  }
}
