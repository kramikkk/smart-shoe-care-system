'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemHeader } from '@/components/ui/item'
import Image from 'next/image'
import { BackButton } from '@/components/kiosk/BackButton'
import { StepIndicator } from '@/components/kiosk/StepIndicator'

const CUSTOM_STEPS = ['Mode', 'Shoe Type', 'Service', 'Care Type', 'Payment']
const AUTO_STEPS = ['Mode', 'Scan Shoes', 'Payment']

type ServiceType = 'cleaning' | 'drying' | 'sterilizing' | 'package'

interface Service {
  id: ServiceType
  name: string
  price: number
}

const defaultServices: Service[] = [
  { id: 'cleaning',    name: 'Cleaning',    price: 45 },
  { id: 'drying',      name: 'Drying',      price: 45 },
  { id: 'sterilizing', name: 'Sterilizing', price: 25 },
  { id: 'package',     name: 'Package',     price: 100 }
]

const paymentMethods = [
  {
    id: 'offline',
    icon: <Image src="/Cash3D.webp" alt="Cash Payment" width={64} height={64} className="w-16 h-16" />,
    title: 'Cash Payment',
    descriptions: ['Insert coins or bills into the machine', 'Accepts: ₱1, ₱5, ₱10, ₱20, ₱50, ₱100'],
  },
  {
    id: 'online',
    icon: <Image src="/QR3D.png" alt="Online Payment" width={64} height={64} className="w-16 h-16" />,
    title: 'Online Payment',
    descriptions: ['Scan QR code with your mobile device', 'Supports GCash, PayMaya, and GrabPay'],
  },
]

const Payment = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const shoe = searchParams.get('shoe') || 'N/A'
  const service = searchParams.get('service')
  const care = searchParams.get('care')

  const [selected, setSelected] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>(defaultServices)

  useEffect(() => {
    const fetchPricing = async () => {
      try {
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
      } catch {
        // use defaults
      }
    }
    fetchPricing()
  }, [])

  const serviceDetails = services.find(s => s.id === service) || services.find(s => s.id === 'package')!

  const summaryData = [
    { label: 'Shoe Type', value: shoe.charAt(0).toUpperCase() + shoe.slice(1) },
    { label: 'Service',   value: serviceDetails.name },
    { label: 'Care Type', value: !care ? (service === 'package' ? 'Auto' : 'N/A') : care.charAt(0).toUpperCase() + care.slice(1) },
    { label: 'Total',     value: `₱${serviceDetails.price}` },
  ]

  const buildQueryString = () => {
    const params = []
    if (shoe)    params.push(`shoe=${shoe}`)
    if (service) params.push(`service=${service}`)
    if (care)    params.push(`care=${care}`)
    return params.length > 0 ? `?${params.join('&')}` : ''
  }

  const handleProceed = () => {
    if (selected) router.push(`/kiosk/payment/${selected}${buildQueryString()}`)
  }

  const isAutoMode = service === 'package' && !care

  return (
    <div className="px-8 py-2 relative">
      <BackButton />

      <StepIndicator
        steps={isAutoMode ? AUTO_STEPS : CUSTOM_STEPS}
        currentStep={isAutoMode ? 2 : 4}
      />

      <h1 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Select Payment Method
      </h1>

      {/* Summary */}
      <div className="flex justify-center mb-4">
        <Item className="bg-white/50 px-6 py-3 rounded-lg shadow-lg w-full">
          <div className="grid grid-cols-4 gap-4 w-full">
            {summaryData.map((item, index) => (
              <ItemContent key={index} className="flex flex-col items-center">
                <p className="text-sm font-bold text-gray-500">{item.label}</p>
                <p className="text-lg font-semibold text-gray-800">{item.value}</p>
              </ItemContent>
            ))}
          </div>
        </Item>
      </div>

      {/* Payment Method Cards */}
      <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto mb-4">
        {paymentMethods.map((method) => (
          <Item
            key={method.id}
            onClick={() => setSelected(method.id)}
            className={`text-center p-5 rounded-lg shadow-lg flex flex-col items-center cursor-pointer transition-all duration-200 select-none
              ${selected === method.id
                ? 'bg-white/90 ring-4 ring-blue-500 shadow-2xl scale-[1.03]'
                : 'bg-white/50 hover:bg-white/70 hover:shadow-xl'
              }`}
          >
            {method.icon}
            <ItemContent className="flex flex-col items-center space-y-1 mt-2">
              <h2 className="text-xl font-bold">{method.title}</h2>
              <div className="space-y-1">
                {method.descriptions.map((desc, idx) => (
                  <p key={idx} className="text-base text-gray-600">{desc}</p>
                ))}
              </div>
            </ItemContent>
          </Item>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleProceed}
          disabled={!selected}
          className="px-12 py-4 text-lg font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          Proceed
        </Button>
      </div>
    </div>
  )
}

export default Payment
