import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get device filter and distribution type from query params
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('deviceId')
    const type = searchParams.get('type') || 'service' // Default to service

    // Build where clause with optional device filter
    const whereClause: any = {}
    if (deviceId) {
      whereClause.deviceId = deviceId
    }

    // Fetch transactions with optional device filter
    const transactions = await prisma.transaction.findMany({
      where: whereClause
    })

    // Determine which field to group by based on type
    const getGroupKey = (tx: any) => {
      switch (type) {
        case 'shoe':
          return tx.shoeType.toLowerCase()
        case 'care':
          return tx.careType.toLowerCase()
        case 'service':
        default:
          return tx.serviceType.toLowerCase()
      }
    }

    // Group by the selected type and calculate totals
    const distribution = transactions.reduce((acc, tx) => {
      const key = getGroupKey(tx)
      if (!acc[key]) {
        acc[key] = {
          type: key,
          service: 0,
          revenue: 0,
        }
      }
      acc[key].service += 1
      acc[key].revenue += tx.amount
      return acc
    }, {} as Record<string, { type: string; service: number; revenue: number }>)

    // Convert to array
    const serviceData = Object.values(distribution).map((item) => ({
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
    console.error('Error fetching distribution:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch distribution',
      },
      { status: 500 }
    )
  }
}
