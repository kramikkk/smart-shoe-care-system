import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Webhook received:', body)

    // PayMongo sends these events:
    // - payment.paid
    // - payment.failed
    
    const eventType = body.data.attributes.type

    if (eventType === 'payment.paid') {
      const paymentIntentId = body.data.attributes.data.attributes.payment_intent_id
      
      // TODO: Update your database
      console.log('✅ Payment succeeded:', paymentIntentId)
      
      // You can trigger machine here or update order status
    }

    if (eventType === 'payment.failed') {
      const paymentIntentId = body.data.attributes.data.attributes.payment_intent_id
      
      console.log('❌ Payment failed:', paymentIntentId)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}