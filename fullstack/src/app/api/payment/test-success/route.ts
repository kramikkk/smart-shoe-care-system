import { NextRequest, NextResponse } from 'next/server'

/**
 * TEST ENDPOINT ONLY - DO NOT USE IN PRODUCTION
 * 
 * This endpoint simulates a successful payment by manually updating
 * the payment intent status. This allows you to test the success flow
 * without actually paying through the QR code.
 * 
 * Usage:
 * POST /api/payment/test-success
 * Body: { "paymentIntentId": "pi_xxx" }
 * 
 * In production, remove this endpoint or add authentication.
 */
export async function POST(request: NextRequest) {
  // Check if test features are enabled
  const testEnabled = process.env.NEXT_PUBLIC_ENABLE_PAYMENT_TEST === 'true'
  
  if (!testEnabled) {
    return NextResponse.json(
      { success: false, error: 'Test endpoint is disabled' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    console.log('🧪 TEST MODE: Simulating payment success for:', paymentIntentId)
    console.log('⚠️  Note: This does NOT actually update PayMongo')
    console.log('⚠️  Your frontend will still poll PayMongo and see "awaiting_payment"')
    console.log('⚠️  This is just for testing the UI flow')

    // Return a mock "succeeded" status
    // In reality, you'd need to actually mark the payment as succeeded in PayMongo
    // which is NOT possible in test mode without actually paying
    return NextResponse.json({
      success: true,
      message: 'Test success simulation',
      note: 'This is a mock response. PayMongo still shows awaiting_payment.',
      paymentIntentId: paymentIntentId,
      simulatedStatus: 'succeeded'
    })

  } catch (error: any) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Test endpoint failed' 
      },
      { status: 500 }
    )
  }
}
