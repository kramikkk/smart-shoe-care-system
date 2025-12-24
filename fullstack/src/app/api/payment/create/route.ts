import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, description } = body

    console.log('=== Starting QRPH Payment Creation ===')
    console.log('Amount:', amount, 'Description:', description)

    const client = new PayMongoClient()

    // Step 1: Create Payment Intent
    const paymentIntentResponse = await client.createPaymentIntent(amount, description)
    const paymentIntentId = paymentIntentResponse.data.id

    // Step 2: Create QRPH Payment Method
    const paymentMethodResponse = await client.createPaymentMethod()
    const paymentMethodId = paymentMethodResponse.data.id

    // Step 3: Attach Payment Method to Payment Intent
    const attachResponse = await client.attachPaymentMethod(paymentIntentId, paymentMethodId)

    // Step 4: Extract QR Code Image URL
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
        error: error.message || 'Failed to create payment' 
      },
      { status: 500 }
    )
  }
}