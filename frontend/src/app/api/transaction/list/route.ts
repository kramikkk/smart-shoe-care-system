import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Fetch all transactions from database, ordered by newest first
    const transactions = await prisma.transaction.findMany({
      orderBy: {
        dateTime: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
    })
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch transactions',
      },
      { status: 500 }
    )
  }
}
