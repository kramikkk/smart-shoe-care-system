import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'
import { z } from 'zod'

const PaymentCancelSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = PaymentCancelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { paymentIntentId } = validation.data

    console.log('=== Cancelling Payment Intent ===')
    console.log('Payment Intent ID:', paymentIntentId)

    const client = new PayMongoClient()
    const result = await client.cancelPaymentIntent(paymentIntentId)

    console.log('=== Payment Intent Cancelled Successfully ===')

    return NextResponse.json({
      success: true,
      status: result.data.attributes.status,
      message: 'Payment intent cancelled successfully'
    })

  } catch (error) {
    console.error('=== Payment Cancellation Failed ===')
    console.error('Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel payment'
      },
      { status: 500 }
    )
  }
}
