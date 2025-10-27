'use client'

import { Button } from '@/components/ui/button'
import { QrCode, Banknote } from 'lucide-react'
import { Item, ItemContent, ItemHeader } from '@/components/ui/item'
import Link from 'next/link'
import React from 'react'
import { useSearchParams } from 'next/navigation'

type ServiceType = 'cleaning' | 'drying' | 'sterilizing' | 'package'

interface Service {
  id: ServiceType
  name: string
  price: number
}

const services: Service[] = [
  {
    id: 'cleaning',
    name: 'Cleaning',
    price: 45
  },
  {
    id: 'drying',
    name: 'Drying',
    price: 45
  },
  {
    id: 'sterilizing',
    name: 'Sterilizing',
    price: 25
  },
  {
    id: 'package',
    name: 'Package',
    price: 100
  }
]

const Payment = () => {
  const searchParams = useSearchParams()
  const shoe = searchParams.get('shoe') || 'N/A'
  const service = searchParams.get('service')
  const care = searchParams.get('care')
  
  // Get service details
  const getServiceDetails = () => {
    const selectedService = services.find(s => s.id === service) || services.find(s => s.id === 'package')
    return selectedService!
  }

  const serviceDetails = getServiceDetails()

  // Get shoe display name
  const getShoeName = () => {
    return shoe.charAt(0).toUpperCase() + shoe.slice(1)
  }

  // Determine service display name
  const getServiceName = () => {
    return serviceDetails.name
  }

  // Determine care type display name
  const getCareName = () => {
    if (!care) return 'N/A'
    return care.charAt(0).toUpperCase() + care.slice(1)
  }

  // Get total price
  const getTotalPrice = () => {
    return `₱${serviceDetails.price}`
  }

  const summaryData = [
    { label: 'Shoe Type', value: getShoeName() },
    { label: 'Service', value: getServiceName() },
    { label: 'Care Type', value: getCareName() },
    { label: 'Total', value: getTotalPrice() },
  ]

  // Build query string for payment links (include both service and care)
  const buildQueryString = () => {
    const params = []
    if (service) params.push(`service=${service}`)
    if (care) params.push(`care=${care}`)
    return params.length > 0 ? `?${params.join('&')}` : ''
  }

  const queryString = buildQueryString()

  const paymentMethods = [
    {
      icon: <Banknote className="w-16 h-16 text-blue-600" />,
      title: 'Cash Payment',
      descriptions: [
        'Insert coins or bills into the machine',
        'Accepts: ₱1, ₱5, ₱10, ₱20, ₱50, ₱100',
      ],
      link: `/user/payment/offline${queryString}`,
    },
    {
      icon: <QrCode className="w-16 h-16 text-cyan-600" />,
      title: 'Online Payment',
      descriptions: [
        'Scan QR code with your mobile device',
        'Supports GCash, PayMaya, and GrabPay',
      ],
      link: `/user/payment/online${queryString}`,
    },
  ]

  return (
    <div className="px-8 py-6">
      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Select Payment Method
      </h1>

      {/* Summary Section */}
      <div className="flex justify-center mb-8">
        <Item className="bg-white/50 p-8 rounded-lg shadow-lg w-full">
          <ItemHeader className="w-full flex justify-center">
            <h2 className="text-3xl font-bold">Summary</h2>
          </ItemHeader>
          <div className="grid grid-cols-4 gap-6 w-full">
            {summaryData.map((item, index) => (
              <ItemContent key={index} className="flex flex-col items-center">
                <p className="text-xl font-bold">{item.label}</p>
                <p className="text-xl text-gray-600">{item.value}</p>
              </ItemContent>
            ))}
          </div>
        </Item>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {paymentMethods.map((method, index) => (
          <Item
            key={index}
            className="text-center bg-white/50 p-8 rounded-lg shadow-lg flex flex-col items-center hover:shadow-xl transition-shadow"
          >
            {method.icon}
            <ItemContent className="flex flex-col items-center space-y-3">
              <h2 className="text-2xl font-bold mb-2">{method.title}</h2>
              <div className="space-y-2">
                {method.descriptions.map((desc, idx) => (
                  <p key={idx} className="text-lg text-gray-600">{desc}</p>
                ))}
              </div>
              <Link href={method.link}>
                <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                  <p className="text-lg font-bold">Select {method.title}</p>
                </Button>
              </Link>
            </ItemContent>
          </Item>
        ))}
      </div>
    </div>
  )
}

export default Payment