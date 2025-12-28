import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'
import { z } from 'zod'

const PaymentStatusQuerySchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams)

    // Validate query parameters
    const validation = PaymentStatusQuerySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { paymentIntentId } = validation.data

    const client = new PayMongoClient()
    const paymentIntent = await client.getPaymentIntentStatus(paymentIntentId)

    const status = paymentIntent.data.attributes.status

    console.log('Payment Status Check:', {
      paymentIntentId,
      status
    })

    return NextResponse.json({
      success: true,
      status: status,
      paymentIntent: paymentIntent.data
    })

  } catch (error) {
    console.error('Payment status check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check payment status'
      },
      { status: 500 }
    )
  }
}