'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent } from '@/components/ui/item'
import React, { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BackButton } from '@/components/BackButton'

type ServiceType = 'cleaning' | 'drying' | 'sterilizing' | 'package'

interface Service {
  id: ServiceType
  name: string
  price: number
}

const defaultServices: Service[] = [
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
  const router = useRouter()
  const shoe = searchParams.get('shoe') || 'mesh'
  const service = searchParams.get('service') as ServiceType || 'package'
  const care = searchParams.get('care') || 'normal'

  // State for services with default fallback
  const [services, setServices] = useState<Service[]>(defaultServices)

  // Fetch pricing from database
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        // Get device ID from localStorage (set by PairingWrapper)
        const deviceId = localStorage.getItem('kiosk_device_id')
        const deviceParam = deviceId ? `?deviceId=${deviceId}` : ''

        const response = await fetch(`/api/pricing${deviceParam}`)
        const data = await response.json()

        if (data.success) {
          const fetchedServices: Service[] = data.pricing.map((item: any) => ({
            id: item.serviceType as ServiceType,
            name: item.serviceType.charAt(0).toUpperCase() + item.serviceType.slice(1),
            price: item.price,
          }))
          setServices(fetchedServices)
        }
      } catch (error) {
        console.error('Error fetching pricing, using defaults:', error)
      }
    }

    fetchPricing()
  }, [])

  // Get the service details based on the service parameter
  const selectedService = useMemo(() => {
    console.log('Looking for service:', service)
    console.log('Available services:', services)
    const found = services.find((s) => s.id === service)
    console.log('Found service:', found)
    return found || services[3] // default to package
  }, [service, services])

  const amountDue = selectedService.price
  const [amountInserted, setAmountInserted] = useState(0)
  const amountRemaining = Math.max(0, amountDue - amountInserted)
  const [isSaving, setIsSaving] = useState(false)

  // Check if payment is complete (amount inserted >= amount due OR amount due is 0)
  const isPaymentComplete = amountDue === 0 || amountInserted >= amountDue

  // STEP 3A: Handle payment proceed - save transaction and redirect
  const handleProceed = async () => {
    // Don't allow proceeding if payment is not complete
    if (!isPaymentComplete) {
      return
    }

    setIsSaving(true)

    try {
      // Save transaction to database
      // Get device ID from localStorage (set by PairingWrapper)
      const deviceId = localStorage.getItem('kiosk_device_id')

      console.log('Device ID from localStorage:', deviceId)
      console.log('Transaction data:', {
        paymentMethod: 'Cash',
        serviceType: service.charAt(0).toUpperCase() + service.slice(1),
        shoeType: shoe.charAt(0).toUpperCase() + shoe.slice(1),
        careType: care.charAt(0).toUpperCase() + care.slice(1),
        amount: selectedService.price,
        deviceId,
      })

      const response = await fetch('/api/transaction/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'Cash',
          serviceType: service.charAt(0).toUpperCase() + service.slice(1), // Capitalize first letter
          shoeType: shoe.charAt(0).toUpperCase() + shoe.slice(1),
          careType: care.charAt(0).toUpperCase() + care.slice(1),
          deviceId, // Link transaction to this kiosk
        }),
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Transaction saved:', data.transaction.transactionId)
      } else {
        console.error('❌ Failed to save transaction:', data.error)
        if (data.details) {
          console.error('Validation errors:', data.details)
        }
      }
    } catch (error) {
      console.error('❌ Transaction save error:', error)
      // Continue to success page even if transaction save fails
    } finally {
      setIsSaving(false)
      // Redirect to success page
      router.push(`/user/success/payment?shoe=${shoe}&service=${service}&care=${care}`)
    }
  }

  return (
    <div className="px-8 py-4 relative">
      <BackButton />

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
            <Button
              onClick={handleProceed}
              disabled={!isPaymentComplete || isSaving}
              className="w-full mt-4 px-4 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <p className='text-base font-bold'>Processing...</p>
                </>
              ) : (
                <p className='text-base font-bold'>
                  {isPaymentComplete ? 'Proceed' : 'Insert Full Amount'}
                </p>
              )}
            </Button>
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