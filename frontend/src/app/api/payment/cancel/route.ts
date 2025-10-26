import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

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

  } catch (error: any) {
    console.error('=== Payment Cancellation Failed ===')
    console.error('Error:', error.message)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to cancel payment' 
      },
      { status: 500 }
    )
  }
}
