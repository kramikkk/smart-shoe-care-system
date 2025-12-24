'use client'

import { Button } from '@/components/ui/button'
import { HandHeart, HeartHandshake, BicepsFlexed } from 'lucide-react'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CareContent() {
  const searchParams = useSearchParams()
  const service = searchParams.get('service') || 'cleaning'
  const shoe = searchParams.get('shoe') || 'mesh'

  // Service-specific descriptions for each care type
  const getDescription = (careId: string) => {
    const descriptions: Record<string, Record<string, string>> = {
      cleaning: {
        gentle: 'Soft brushing with light pressure and slow rotation, ideal for delicate shoe materials',
        normal: 'Standard cleaning with balanced pressure and rotation, suitable for everyday shoes',
        strong: 'Strong cleaning with strong pressure and fast rotation, perfect for heavily stained shoes'
      },
      drying: {
        gentle: 'Mild drying cycle (1 minute)',
        normal: 'Standard drying cycle (3 minutes)',
        strong: 'Extended drying cycle (5 minutes)'
      },
      sterilizing: {
        gentle: 'Mild UV sterilization and deodorization (1 minute)',
        normal: 'Standard UV sterilization and deodorization (3 minutes)',
        strong: 'Maximum UV sterilization and deodorization (5 minutes)'
      },
      package: {
        gentle: 'Complete care with gentle settings: Soft cleaning + Low-heat drying + Mild UV. Perfect for delicate shoes (~90 min)',
        normal: 'Complete care with standard settings: Standard cleaning + Moderate drying + Normal UV. Suitable for most shoes (~60 min)',
        strong: 'Complete care with maximum power: Strong cleaning + Fast drying + Maximum UV. Best for heavily soiled shoes (~45 min)'
      }
    }

    return descriptions[service]?.[careId] || descriptions.cleaning[careId]
  }

  const careTypes = [
    {
      id: 'gentle',
      name: 'Gentle',
      icon: HandHeart,
      color: 'text-green-600',
    },
    {
      id: 'normal',
      name: 'Normal',
      icon: HeartHandshake,
      color: 'text-yellow-600',
    },
    {
      id: 'strong',
      name: 'Strong',
      icon: BicepsFlexed,
      color: 'text-red-600',
    },
  ]

  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Choose Care Type
      </h1>
      <div className='flex gap-8 justify-center'>
        {careTypes.map((care) => {
          const Icon = care.icon
          const desc = getDescription(care.id)
          
          return (
            <Item key={care.id} className='text-center bg-white/50 p-8 rounded-lg shadow-lg w-80 flex flex-col items-center hover:shadow-xl transition-shadow'>
              <Icon className={`w-16 h-16 ${care.color}`} />
              <ItemContent className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-2">{care.name}</h2>
                <p className="text-xl text-gray-700 mb-6 px-2">{desc}</p>
                <Link href={`/user/payment?shoe=${shoe}&service=${service}&care=${care.id}`}>
                  <Button className="px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                    <p className='text-lg font-bold'>Select {care.name}</p>
                  </Button>
                </Link>
              </ItemContent>
            </Item>
          )
        })}
      </div>
    </div>
  )
}

const Care = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CareContent />
    </Suspense>
  )
}

export default Care