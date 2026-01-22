import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

// Input validation schema
const TransactionSchema = z.object({
  paymentMethod: z.enum(['Cash', 'Online']),
  serviceType: z.enum(['Cleaning', 'Drying', 'Sterilizing', 'Package']),
  shoeType: z.enum(['Canvas', 'Rubber', 'Mesh']),
  careType: z.enum(['Gentle', 'Normal', 'Strong', 'Auto']),
  status: z.enum(['Pending', 'Success', 'Failed']).optional().default('Success'),
  deviceId: z.string().regex(/^SSCM-[A-F0-9]{6}$/, 'Device ID is required and must be in format SSCM-XXXXXX'),
})

/**
 * POST /api/transaction/create
 *
 * Creates a new transaction record in the database
 * Called when a user completes payment (online or offline)
 */
export async function POST(req: NextRequest) {
  // Apply rate limiting (30 requests per minute per IP)
  const rateLimitResult = rateLimit(req, { maxRequests: 30, windowMs: 60000 })
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    // Parse and validate the request body
    const body = await req.json()

    const validation = TransactionSchema.safeParse(body)
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

    const { paymentMethod, serviceType, shoeType, careType, status, deviceId } = validation.data

    // Fetch device-specific pricing (or fallback to global pricing)
    const serviceTypeLower = serviceType.toLowerCase()
    let pricing = await prisma.servicePricing.findFirst({
      where: {
        deviceId,
        serviceType: serviceTypeLower,
      },
    })

    // If no device-specific pricing exists, fetch global default
    if (!pricing) {
      pricing = await prisma.servicePricing.findFirst({
        where: {
          deviceId: null,
          serviceType: serviceTypeLower,
        },
      })
    }

    // If still no pricing exists, return error
    if (!pricing) {
      return NextResponse.json(
        {
          success: false,
          error: `No pricing found for service type: ${serviceType}`,
        },
        { status: 400 }
      )
    }

    const amount = pricing.price

    // Generate transaction ID in format TXN-1, TXN-2, TXN-3, etc.
    // Get the count of existing transactions to determine the next ID
    const transactionCount = await prisma.transaction.count()
    const nextNumber = transactionCount + 1
    const transactionId = `TXN-${nextNumber}`

    // Save the transaction to the database
    const transaction = await prisma.transaction.create({
      data: {
        transactionId,
        dateTime: new Date(),
        paymentMethod,
        serviceType,
        shoeType,
        careType,
        amount,
        status,
        deviceId, // Link transaction to device/kiosk
      },
    })

    // Get rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(req, { maxRequests: 30, windowMs: 60000 })

    // Return success response with transaction details
    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: transaction.id,
          transactionId: transaction.transactionId,
          dateTime: transaction.dateTime,
        },
      },
      {
        headers: rateLimitHeaders
      }
    )
  } catch (error) {
    console.error('Transaction creation error:', error)

    // Don't expose internal error details to client
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}
