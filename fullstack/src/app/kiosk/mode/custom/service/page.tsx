'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Item, ItemContent } from '@/components/ui/item'
import Image from 'next/image'
import { BackButton } from '@/components/kiosk/BackButton'
import { StepIndicator } from '@/components/kiosk/StepIndicator'

const CUSTOM_STEPS = ['Mode', 'Shoe Type', 'Service', 'Care Type', 'Payment']

const defaultPrices: Record<string, number> = {
  cleaning: 45,
  drying: 45,
  sterilizing: 25,
}

const services = [
  { id: 'cleaning',    label: 'Cleaning',    desc: 'Surface clean your shoes', image: '/Water3D.webp' },
  { id: 'drying',      label: 'Drying',      desc: 'Quick dry your shoes',     image: '/Wind3D.webp' },
  { id: 'sterilizing', label: 'Sterilizing', desc: 'Sanitize your shoes',      image: '/Shield3D.webp' },
]

const ServicePage = () => {
  const searchParams = useSearchParams()
  const shoe = searchParams.get('shoe') || 'mesh'
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(null)
  const [prices, setPrices] = useState(defaultPrices)

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const deviceId = localStorage.getItem('kiosk_device_id')
        const deviceParam = deviceId ? `?deviceId=${deviceId}` : ''
        const res = await fetch(`/api/pricing${deviceParam}`)
        const data = await res.json()
        if (data.success) {
          const map: Record<string, number> = { ...defaultPrices }
          for (const item of data.pricing) map[item.serviceType] = item.price
          setPrices(map)
        }
      } catch {
        // use defaults
      }
    }
    fetchPricing()
  }, [])

  const handleProceed = () => {
    if (selected) router.push(`/kiosk/mode/custom/care?shoe=${shoe}&service=${selected}`)
  }

  return (
    <div className="relative">
      <BackButton />

      <StepIndicator steps={CUSTOM_STEPS} currentStep={2} />

      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Choose Service Type
      </h1>

      <div className='flex gap-8 justify-center mb-8'>
        {services.map((svc) => (
          <Item
            key={svc.id}
            onClick={() => setSelected(svc.id)}
            className={`text-center p-8 rounded-lg shadow-lg flex flex-col items-center cursor-pointer transition-all duration-200 select-none
              ${selected === svc.id
                ? 'bg-white/90 ring-4 ring-blue-500 shadow-2xl scale-[1.03]'
                : 'bg-white/50 hover:bg-white/70 hover:shadow-xl'
              }`}
          >
            <Image src={svc.image} alt={svc.label} width={128} height={128} className="w-32 h-32" />
            <ItemContent>
              <h2 className="text-2xl font-bold mb-2">{svc.label}</h2>
              <p className="text-xl text-gray-600 mb-2">{svc.desc}</p>
              <span className="inline-block w-fit self-center px-4 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full text-base font-bold text-blue-800 shadow-sm">
                ₱{prices[svc.id]}
              </span>
            </ItemContent>
          </Item>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleProceed}
          disabled={!selected}
          className="px-12 py-6 text-xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          Proceed
        </Button>
      </div>
    </div>
  )
}

export default ServicePage
