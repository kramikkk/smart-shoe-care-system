import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Fetch all service pricing
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
  } catch (error: any) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pricing',
      },
      { status: 500 }
    )
  }
}

// PUT - Update service pricing
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { serviceType, price } = body

    if (!serviceType || price === undefined || price === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service type and price are required',
        },
        { status: 400 }
      )
    }

    if (price < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Price must be a positive number',
        },
        { status: 400 }
      )
    }

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
  } catch (error: any) {
    console.error('Error updating pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update pricing',
      },
      { status: 500 }
    )
  }
}
