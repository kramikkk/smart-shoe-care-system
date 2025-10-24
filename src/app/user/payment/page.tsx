'use client'

import { Button } from '@/components/ui/button'
import { QrCode, Banknote } from 'lucide-react'
import { Item, ItemContent, ItemHeader } from '@/components/ui/item'
import Link from 'next/link'
import React from 'react'
import { useSearchParams } from 'next/navigation'

const Payment = () => {
  const searchParams = useSearchParams()
  const service = searchParams.get('service')
  
  // Determine service display name
  const getServiceName = () => {
    if (service === 'package') return 'Package'
    if (service) return service.charAt(0).toUpperCase() + service.slice(1)
    return 'Package'
  }

  const summaryData = [
    { label: 'Shoe Type', value: 'Rubber' },
    { label: 'Service', value: getServiceName() },
    { label: 'Total', value: '₱100' },
  ]

  // Build query string for payment links
  const queryString = service ? `service=${service}` : ''

  const paymentMethods = [
    {
      icon: <Banknote className="w-16 h-16 text-blue-600" />,
      title: 'Cash Payment',
      descriptions: [
        'Insert coins or bills into the machine',
        'Accepts: ₱1, ₱5, ₱10, ₱20, ₱50, ₱100',
      ],
      link: `/user/payment/offline${queryString ? `?${queryString}` : ''}`,
    },
    {
      icon: <QrCode className="w-16 h-16 text-cyan-600" />,
      title: 'Online Payment',
      descriptions: [
        'Scan QR code with your mobile device',
        'Supports GCash, PayMaya, and GrabPay',
      ],
      link: `/user/payment/online${queryString ? `?${queryString}` : ''}`,
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
          <div className="grid grid-cols-3 gap-6 w-full">
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