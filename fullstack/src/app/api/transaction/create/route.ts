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
    if (!paymentMethod || !serviceType || !shoeType || !careType || amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate a simple auto-incrementing transaction ID
    // Format: TXN-1, TXN-2, TXN-3, etc.
    const now = new Date()

    // Get the count of existing transactions to determine the next ID
    const transactionCount = await prisma.transaction.count()
    const nextNumber = transactionCount + 1
    const transactionId = `TXN-${nextNumber}`

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
