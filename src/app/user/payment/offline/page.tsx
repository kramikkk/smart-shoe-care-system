'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

const Offline = () => {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const service = searchParams.get('service')
  
  const amountDue = 100
  const [amountInserted, setAmountInserted] = useState(0)
  const amountRemaining = Math.max(0, amountDue - amountInserted)
  
  // Determine the redirect URL after payment
  const getRedirectUrl = () => {
    if (mode === 'auto') {
      return '/user/success/payment?mode=auto'
    }
    if (service) {
      return `/user/success/payment?service=${service}`
    }
    return '/user/mode/custom'
  }

  return (
    <div className="px-8 py-6">
      <h1 className="text-5xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Cash Payment
      </h1>

      {/* Caution Message */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-yellow-700 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-yellow-800">⚠️ CAUTION: Insert Exact Amount Only</p>
            <p className="text-md text-yellow-700">This machine does not provide change. Please insert the exact amount.</p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-8 max-w-6xl mx-auto'>
        {/* Left Side - Payment Information */}
        <Item className='bg-white/50 p-8 rounded-lg shadow-lg flex flex-col w-100'>
          <ItemContent className="flex flex-col h-full w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Payment Details</h2>
            
            <div className="space-y-4 flex-1">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-lg font-bold text-gray-700">Amount Due</p>
                <p className="text-3xl font-bold text-blue-600">₱{amountDue.toFixed(2)}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-lg font-bold text-gray-700">Amount Inserted</p>
                <p className="text-3xl font-bold text-green-600">₱{amountInserted.toFixed(2)}</p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-lg font-bold text-gray-700">Amount Remaining</p>
                <p className="text-3xl font-bold text-red-600">₱{amountRemaining.toFixed(2)}</p>
              </div>
            </div>
            <Link href={getRedirectUrl()} className="mt-6">
              <Button className="w-full px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Proceed</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>

        {/* Right Side - Bill Acceptor and Coin Slot */}
        <div className="flex flex-col gap-6 h-full">
          <Card className='py-4 shadow-md bg-gray-600 text-white flex-1 flex flex-col'>
            <p className='px-4 text-left font-bold text-lg mb-2'>
              Bill Acceptor
            </p>
            <CardContent className="flex-1 flex items-center">
              <Card className='w-full py-10 bg-black/50 border-2 border-dashed border-gray-400'>
              </Card>
            </CardContent>
            <p className='text-right px-4 text-sm'>
              Accepts: ₱20, ₱50, ₱100
            </p>
          </Card>

          <Card className='py-4 shadow-md bg-gray-600 text-white flex-1 flex flex-col'>
            <p className='px-4 text-left font-bold text-lg mb-2'>
              Coin Slot
            </p>
            <CardContent className="flex-1 flex justify-center items-center">
              <Card className='py-2 w-8 h-32 bg-black/50 border-2 border-dashed border-gray-400'>
              </Card>
            </CardContent>
            <p className='text-right px-4 text-sm'>
              Accepts: ₱1, ₱5, ₱10, ₱20
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Offline