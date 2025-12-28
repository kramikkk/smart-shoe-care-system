import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const PricingUpdateSchema = z.object({
  serviceType: z.enum(['cleaning', 'drying', 'sterilizing', 'package']),
  price: z.number().nonnegative('Price must be a non-negative number'),
})

// GET - Fetch all service pricing (public endpoint)
export async function GET(req: NextRequest) {
  try {
    const pricing = await prisma.servicePricing.findMany({
      orderBy: {
        serviceType: 'asc',
      },
    })

    // If no pricing exists, create default pricing
    if (pricing.length === 0) {
      const defaultPricing = [
        { serviceType: 'cleaning', price: 45 },
        { serviceType: 'drying', price: 45 },
        { serviceType: 'sterilizing', price: 25 },
        { serviceType: 'package', price: 100 },
      ]

      await prisma.servicePricing.createMany({
        data: defaultPricing,
      })

      const newPricing = await prisma.servicePricing.findMany({
        orderBy: {
          serviceType: 'asc',
        },
      })

      return NextResponse.json({
        success: true,
        pricing: newPricing,
      })
    }

    return NextResponse.json({
      success: true,
      pricing,
    })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pricing',
      },
      { status: 500 }
    )
  }
}

// PUT - Update service pricing (requires authentication)
export async function PUT(req: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await req.json()

    // Validate input
    const validation = PricingUpdateSchema.safeParse(body)
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

    const { serviceType, price } = validation.data

    // Update or create pricing
    const updatedPricing = await prisma.servicePricing.upsert({
      where: {
        serviceType,
      },
      update: {
        price,
      },
      create: {
        serviceType,
        price,
      },
    })

    return NextResponse.json({
      success: true,
      pricing: updatedPricing,
    })
  } catch (error) {
    console.error('Error updating pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pricing',
      },
      { status: 500 }
    )
  }
}
