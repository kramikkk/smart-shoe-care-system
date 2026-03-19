import { NextRequest, NextResponse } from 'next/server'
import { PayMongoClient } from '@/lib/paymongo/client'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

const PaymentCreateSchema = z.object({
  amount: z.number().min(1).max(50000),
  description: z.string().min(1),
  deviceId: z.string().regex(/^SSCM-[A-F0-9]{6}$/, 'Invalid device ID format'),
  shoeType: z.enum(['Canvas', 'Rubber', 'Mesh']),
  careType: z.enum(['Gentle', 'Normal', 'Strong', 'Auto']),
  serviceType: z.enum(['Cleaning', 'Drying', 'Sterilizing', 'Package']),
})

export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request, { maxRequests: 10, windowMs: 60000 })
  if (rateLimitResult) return rateLimitResult

  const groupToken = request.headers.get('X-Group-Token')
  if (!groupToken) {
    return NextResponse.json({ success: false, error: 'Missing X-Group-Token' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = PaymentCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { amount, description, deviceId, shoeType, careType, serviceType } = validation.data

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { groupToken: true },
    })
    if (!device || device.groupToken !== groupToken) {
      return NextResponse.json({ success: false, error: 'Invalid group token' }, { status: 403 })
    }

    const client = new PayMongoClient()

    // Pass all service metadata so webhook can create Transaction on success
    const paymentIntentResponse = await client.createPaymentIntent(
      amount,
      description,
      { deviceId, shoeType, careType, serviceType, amount: String(amount), paymentMethod: 'Online' }
    )
    const paymentIntentId = paymentIntentResponse.data.id

    const paymentMethodResponse = await client.createPaymentMethod()
    const paymentMethodId = paymentMethodResponse.data.id

    const attachResponse = await client.attachPaymentMethod(paymentIntentId, paymentMethodId)
    const qrImageUrl = attachResponse.data.attributes.next_action?.code?.image_url

    if (!qrImageUrl) {
      throw new Error('No QR code image received from PayMongo')
    }

    return NextResponse.json({
      success: true,
      paymentIntentId,
      qrImageUrl,
      status: attachResponse.data.attributes.status,
    })
  } catch (error) {
    console.error('Payment creation failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 })
  }
}
