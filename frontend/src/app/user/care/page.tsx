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

  // Service-specific descriptions for each care type
  const getDescriptions = (careId: string) => {
    const descriptions: Record<string, Record<string, { main: string; details: string[] }>> = {
      cleaning: {
        gentle: {
          main: 'Soft brushing for delicate shoe materials',
          details: [
            'Light pressure & slow rotation',
            'Ideal for delicate shoes',
          ]
        },
        normal: {
          main: 'Standard cleaning for everyday shoes',
          details: [
            'Balanced pressure & rotation',
            'Ideal for most shoe types',
          ]
        },
        strong: {
          main: 'Hard cleaning for heavily stained shoes',
          details: [
            'Strong pressure & fast rotation',
            'Ideal for tough shoes'
          ]
        }
      },
      drying: {
        gentle: {
          main: 'Mild drying',
          details: [
            'Shortened cycle (1 min)',
          ]
        },
        normal: {
          main: 'Standard drying',
          details: [
            'Standard cycle (3 min)',
          ]
        },
        strong: {
          main: 'Strong drying',
          details: [
            'Extended cycle (5 min)',
          ]
        }
      },
      sterilizing: {
        gentle: {
          main: 'Mild UV sterilization & deodorization',
          details: [
            'Standard cycle (1 min)'
          ]
        },
        normal: {
          main: 'Standard UV sterilization & deodorization',
          details: [
            'Standard cycle (3 min)'
          ]
        },
        strong: {
          main: 'Maximum UV sterilization & deodorization',
          details: [
            'Extended cycle (5 min)'
          ]
        }
      },
      package: {
        gentle: {
          main: 'Complete care with gentle settings',
          details: [
            'Soft cleaning + Low-heat drying + Mild UV',
            'Perfect for delicate shoes',
            'Total time: ~90 minutes',
            'Safest complete treatment'
          ]
        },
        normal: {
          main: 'Complete care with standard settings',
          details: [
            'Standard cleaning + Moderate drying + Normal UV',
            'Suitable for most shoe types',
            'Total time: ~60 minutes',
            'Balanced complete treatment'
          ]
        },
        strong: {
          main: 'Complete care with maximum power',
          details: [
            'Deep cleaning + Fast drying + Maximum UV',
            'Best for heavily soiled shoes',
            'Total time: ~45 minutes',
            'Most powerful treatment'
          ]
        }
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
          const desc = getDescriptions(care.id)
          
          return (
            <Item key={care.id} className='text-center bg-white/50 p-8 rounded-lg shadow-lg w-80 flex flex-col items-center hover:shadow-xl transition-shadow'>
              <Icon className={`w-16 h-16 ${care.color}`} />
              <ItemContent className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-2">{care.name}</h2>
                <p className="text-lg text-gray-700 font-medium mb-4">{desc.main}</p>
                <ul className="text-left space-y-2 mb-6 w-full px-4">
                  {desc.details.map((detail, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                      <span className="mr-2 text-cyan-600">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/user/payment?service=${service}&care=${care.id}`}>
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