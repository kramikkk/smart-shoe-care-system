import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

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
    const paymentData = body.data.attributes.data.attributes

    if (eventType === 'payment.paid') {
      const paymentIntentId = paymentData.payment_intent_id
      const metadata = paymentData.metadata
      const transactionId = metadata?.transactionId

      console.log('✅ Payment succeeded:', paymentIntentId)
      console.log('Transaction ID:', transactionId)

      if (transactionId) {
        // Update transaction status to Success
        const updatedTransaction = await prisma.transaction.update({
          where: { transactionId },
          data: { status: 'Success' }
        })

        console.log('✅ Transaction updated to Success:', updatedTransaction.transactionId)

        // TODO: Trigger machine hardware here if needed
      } else {
        console.warn('⚠️ No transaction ID in payment metadata')
      }
    }

    if (eventType === 'payment.failed') {
      const paymentIntentId = paymentData.payment_intent_id
      const metadata = paymentData.metadata
      const transactionId = metadata?.transactionId

      console.log('❌ Payment failed:', paymentIntentId)
      console.log('Transaction ID:', transactionId)

      if (transactionId) {
        // Update transaction status to Failed
        const updatedTransaction = await prisma.transaction.update({
          where: { transactionId },
          data: { status: 'Failed' }
        })

        console.log('✅ Transaction updated to Failed:', updatedTransaction.transactionId)
      } else {
        console.warn('⚠️ No transaction ID in payment metadata')
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}