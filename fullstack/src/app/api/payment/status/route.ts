import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentIntentId = searchParams.get('paymentIntentId')

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

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

  } catch (error: any) {
    console.error('Payment status check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to check payment status' 
      },
      { status: 500 }
    )
  }
}