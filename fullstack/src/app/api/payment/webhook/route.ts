import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// PayMongo webhook signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
  
  if (!webhookSecret) {
    console.error('PAYMONGO_WEBHOOK_SECRET not configured')
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload, 'utf8')
    .digest('hex')

  return signature === expectedSignature
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)
    
    // Verify webhook signature (IMPORTANT for security!)
    const signature = request.headers.get('paymongo-signature')
    
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      console.error('⚠️ Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    console.log('✅ Webhook signature verified')
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