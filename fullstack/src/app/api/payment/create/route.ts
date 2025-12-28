import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

const PaymentCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
})

export async function POST(request: NextRequest) {
  // Apply rate limiting (10 payment creations per minute per IP)
  const rateLimitResult = rateLimit(request, { maxRequests: 10, windowMs: 60000 })
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = PaymentCreateSchema.safeParse(body)
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

    const { amount, description } = validation.data

    console.log('=== Starting QRPH Payment Creation ===')
    console.log('Amount:', amount, 'Description:', description)

    const client = new PayMongoClient()

    // Step 1: Create Payment Intent (transaction will be created after payment succeeds)
    const paymentIntentResponse = await client.createPaymentIntent(
      amount,
      description
    )
    const paymentIntentId = paymentIntentResponse.data.id

    // Step 3: Create QRPH Payment Method
    const paymentMethodResponse = await client.createPaymentMethod()
    const paymentMethodId = paymentMethodResponse.data.id

    // Step 4: Attach Payment Method to Payment Intent
    const attachResponse = await client.attachPaymentMethod(paymentIntentId, paymentMethodId)

    // Step 5: Extract QR Code Image URL
    const qrImageUrl = attachResponse.data.attributes.next_action?.code?.image_url

    if (!qrImageUrl) {
      console.error('No QR code image URL in response:', attachResponse)
      throw new Error('No QR code image received from PayMongo')
    }

    console.log('=== QRPH Payment Created Successfully ===')
    console.log('Payment Intent ID:', paymentIntentId)
    console.log('QR Code Generated: Yes')

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntentId,
      qrImageUrl: qrImageUrl,
      status: attachResponse.data.attributes.status
    })

  } catch (error: any) {
    console.error('=== Payment Creation Failed ===')
    console.error('Error:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create payment'
      },
      { status: 500 }
    )
  }
}