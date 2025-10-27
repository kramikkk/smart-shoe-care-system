'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import React, { useState, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
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

const Offline = () => {
  const searchParams = useSearchParams()
  const shoe = searchParams.get('shoe') || 'mesh'
  const service = searchParams.get('service') as ServiceType || 'package'
  const care = searchParams.get('care') || 'normal'
  
  // Get the service details based on the service parameter
  const selectedService = useMemo(() => {
    return services.find(s => s.id === service) || services[3] // default to package
  }, [service])
  
  const amountDue = selectedService.price
  const [amountInserted, setAmountInserted] = useState(0)
  const amountRemaining = Math.max(0, amountDue - amountInserted)
  
  // Determine the redirect URL after payment
  const getRedirectUrl = () => {
    return `/user/success/payment?shoe=${shoe}&service=${service}&care=${care}`
  }

  return (
    <div className="px-8 py-4">
      <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Cash Payment
      </h1>

      {/* Caution Message */}
      <div className="max-w-5xl mx-auto mb-4">
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-10 h-10 text-yellow-700 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-yellow-800">CAUTION: Insert Exact Amount Only</p>
            <p className="text-sm text-yellow-700">This machine does not provide change. Please insert the exact amount.</p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-6 max-w-5xl mx-auto'>
        {/* Left Side - Payment Information */}
        <Item className='bg-white/50 p-6 rounded-lg shadow-lg flex flex-col w-100'>
          <ItemContent className="flex flex-col h-full w-full">
            <h2 className="text-2xl font-bold mb-4 text-center">Payment Details</h2>
            
            <div className="space-y-3 flex-1">
              <div className="bg-purple-50 p-3 rounded-lg border-2 border-purple-200">
                <p className="text-sm font-bold text-gray-700">Service</p>
                <p className="text-xl font-bold text-purple-600">{selectedService.name}</p>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-700">Amount Due</p>
                <p className="text-2xl font-bold text-blue-600">₱{amountDue.toFixed(2)}</p>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-700">Amount Inserted</p>
                <p className="text-2xl font-bold text-green-600">₱{amountInserted.toFixed(2)}</p>
              </div>
              
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-700">Amount Remaining</p>
                <p className="text-2xl font-bold text-red-600">₱{amountRemaining.toFixed(2)}</p>
              </div>
            </div>
            <Link href={getRedirectUrl()} className="mt-4">
              <Button className="w-full px-4 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-base font-bold'>Proceed</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>

        {/* Right Side - Bill Acceptor and Coin Slot */}
        <div className="flex flex-col gap-4 h-full">
          <Card className='py-3 shadow-md bg-gray-600 text-white flex-1 flex flex-col'>
            <p className='px-3 text-left font-bold text-base mb-2'>
              Bill Acceptor
            </p>
            <CardContent className="flex-1 flex items-center">
              <Card className='w-full py-8 bg-black/50 border-2 border-dashed border-gray-400'>
              </Card>
            </CardContent>
            <p className='text-right px-3 text-xs'>
              Accepts: ₱20, ₱50, ₱100
            </p>
          </Card>

          <Card className='py-3 shadow-md bg-gray-600 text-white flex-1 flex flex-col'>
            <p className='px-3 text-left font-bold text-base mb-2'>
              Coin Slot
            </p>
            <CardContent className="flex-1 flex justify-center items-center">
              <Card className='py-2 w-6 h-24 bg-black/50 border-2 border-dashed border-gray-400'>
              </Card>
            </CardContent>
            <p className='text-right px-3 text-xs'>
              Accepts: ₱1, ₱5, ₱10, ₱20
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Offline