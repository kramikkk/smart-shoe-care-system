import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { broadcastPaymentSuccess } from '@/lib/websocket'

/**
 * Verifies the Paymongo-Signature header.
 *
 * Header format: t=<timestamp>,te=<test_sig>,li=<live_sig>
 * Signed payload: "<timestamp>.<rawBody>"
 * HMAC key: PAYMONGO_WEBHOOK_SECRET
 *
 * Use `li` for live mode, `te` for test mode.
 */
function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!webhookSecret) return false

  // Parse the header into parts
  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const idx = part.indexOf('=')
    if (idx !== -1) parts[part.slice(0, idx)] = part.slice(idx + 1)
  }

  const timestamp = parts['t']
  // Use `li` for live mode, fall back to `te` for test mode
  const receivedSig = parts['li'] || parts['te']

  if (!timestamp || !receivedSig) return false

  const signedPayload = `${timestamp}.${rawBody}`
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    const signatureHeader = request.headers.get('paymongo-signature')
    if (!signatureHeader || !verifyWebhookSignature(rawBody, signatureHeader)) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const eventType = body.data.attributes.type
    const paymentData = body.data.attributes.data.attributes

    if (eventType === 'payment.paid') {
      const metadata = paymentData.metadata as Record<string, string> | undefined

      if (!metadata?.deviceId) {
        console.error('[Webhook] payment.paid missing deviceId in metadata')
        return NextResponse.json({ received: true })
      }

      const { deviceId, shoeType, careType, serviceType, amount, paymentMethod } = metadata

      // Idempotency guard — PayMongo retries within seconds on timeout.
      // Use device+amount+service+shoe+care within 60 s to avoid dropping legitimate
      // back-to-back payments while still catching webhook retries.
      const parsedAmount = parseFloat(amount || '0')
      const recentDuplicate = await prisma.transaction.findFirst({
        where: {
          deviceId,
          amount: { gte: parsedAmount - 0.001, lte: parsedAmount + 0.001 },
          serviceType: serviceType || 'Package',
          shoeType: shoeType || '',
          careType: careType || '',
          paymentMethod: 'Online',
          dateTime: { gte: new Date(Date.now() - 60 * 1000) },
        },
      })
      if (recentDuplicate) {
        console.log(`[Webhook] Duplicate payment.paid ignored — existing tx: ${recentDuplicate.id}`)
        return NextResponse.json({ received: true })
      }

      const transaction = await prisma.transaction.create({
        data: {
          dateTime: new Date(),
          paymentMethod: paymentMethod || 'Online',
          serviceType: serviceType || 'Package',
          shoeType,
          careType,
          amount: parsedAmount,
          deviceId,
        },
      })

      broadcastPaymentSuccess(deviceId, transaction.id, transaction.amount)
      console.log(`[Webhook] payment.paid processed — tx: ${transaction.id}, device: ${deviceId}, amount: ₱${transaction.amount}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
