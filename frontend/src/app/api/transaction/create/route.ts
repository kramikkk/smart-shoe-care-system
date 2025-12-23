import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/transaction/create
 *
 * Creates a new transaction record in the database
 * Called when a user completes payment (online or offline)
 */
export async function POST(req: NextRequest) {
  try {
    // Parse the request body to get transaction details
    const body = await req.json()
    const { paymentMethod, serviceType, shoeType, careType, amount } = body

    // Validate that all required fields are present
    if (!paymentMethod || !serviceType || !shoeType || !careType || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate a unique transaction ID
    // Format: TXN-YYYYMMDD-HHMMSS-RANDOM
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '') // HHMMSS
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase() // 4 random chars
    const transactionId = `TXN-${dateStr}-${timeStr}-${randomStr}`

    // Save the transaction to the database using Prisma
    const transaction = await prisma.transaction.create({
      data: {
        transactionId,
        dateTime: now,
        paymentMethod,
        serviceType,
        shoeType,
        careType,
        amount: parseFloat(amount.toString()),
        status: 'Success', // Mark as successful since payment was completed
      },
    })

    // Return success response with transaction details
    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        transactionId: transaction.transactionId,
        dateTime: transaction.dateTime,
      },
    })
  } catch (error: any) {
    console.error('Transaction creation error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create transaction' },
      { status: 500 }
    )
  }
}
