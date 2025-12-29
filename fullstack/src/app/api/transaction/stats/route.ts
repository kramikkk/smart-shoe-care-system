import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get device filter from query params
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('deviceId')

    // Get current date and yesterday's date
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Build where clause with optional device filter
    const whereClause: any = {}
    if (deviceId) {
      whereClause.deviceId = deviceId
    }

    // Fetch transactions with optional device filter
    const allTransactions = await prisma.transaction.findMany({
      where: whereClause
    })

    // Calculate total revenue
    const totalRevenue = allTransactions.reduce((sum, tx) => sum + tx.amount, 0)

    // Calculate total transactions
    const totalTransactions = allTransactions.length

    // Get today's transactions
    const todayTransactions = allTransactions.filter(
      (tx) => new Date(tx.dateTime) >= today
    )
    const todayRevenue = todayTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    const todayCount = todayTransactions.length

    // Get yesterday's transactions
    const yesterdayTransactions = allTransactions.filter(
      (tx) => new Date(tx.dateTime) >= yesterday && new Date(tx.dateTime) < today
    )
    const yesterdayRevenue = yesterdayTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    )
    const yesterdayCount = yesterdayTransactions.length

    // Calculate trends
    const revenueDiff = todayRevenue - yesterdayRevenue
    const transactionDiff = todayCount - yesterdayCount

    const revenueTrend =
      yesterdayRevenue > 0 ? ((revenueDiff / yesterdayRevenue) * 100).toFixed(1) : '0'
    const transactionTrend =
      yesterdayCount > 0 ? ((transactionDiff / yesterdayCount) * 100).toFixed(1) : '0'

    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue: {
          value: totalRevenue,
          formatted: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
          }).format(totalRevenue),
          trend: parseFloat(revenueTrend),
          isPositive: revenueDiff >= 0,
          diff: revenueDiff,
          diffFormatted: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
          }).format(Math.abs(revenueDiff)),
        },
        totalTransactions: {
          value: totalTransactions,
          trend: parseFloat(transactionTrend),
          isPositive: transactionDiff >= 0,
          diff: transactionDiff,
        },
        todayStats: {
          revenue: todayRevenue,
          count: todayCount,
        },
        yesterdayStats: {
          revenue: yesterdayRevenue,
          count: yesterdayCount,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching transaction stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch transaction stats',
      },
      { status: 500 }
    )
  }
}
