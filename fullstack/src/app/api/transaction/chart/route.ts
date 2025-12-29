import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get date range and device filter from query params
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '90')
    const deviceId = searchParams.get('deviceId')

    // Calculate start date
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days)

    // Build where clause with optional device filter
    const whereClause: any = {
      dateTime: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Add device filter if provided
    if (deviceId) {
      whereClause.deviceId = deviceId
    }

    // Fetch transactions within date range
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: {
        dateTime: 'asc',
      },
    })

    // Group transactions by date
    const groupedByDate = transactions.reduce((acc, tx) => {
      const date = new Date(tx.dateTime).toISOString().split('T')[0] // YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = {
          date,
          revenue: 0,
          transactions: 0,
        }
      }
      acc[date].revenue += tx.amount
      acc[date].transactions += 1
      return acc
    }, {} as Record<string, { date: string; revenue: number; transactions: number }>)

    // Convert to array and fill missing dates with zero values
    const chartData = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      chartData.push(
        groupedByDate[dateStr] || {
          date: dateStr,
          revenue: 0,
          transactions: 0,
        }
      )
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({
      success: true,
      chartData,
      summary: {
        totalRevenue: chartData.reduce((sum, d) => sum + d.revenue, 0),
        totalTransactions: chartData.reduce((sum, d) => sum + d.transactions, 0),
        days,
      },
    })
  } catch (error: any) {
    console.error('Error fetching chart data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch chart data',
      },
      { status: 500 }
    )
  }
}
