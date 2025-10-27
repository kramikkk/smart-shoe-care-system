'use client'

import { Droplets, ShieldCheck, Wind } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Progress } from "@/components/ui/progress"
import { useSearchParams, useRouter } from 'next/navigation'

const CustomProgress = () => {
  const searchParams = useSearchParams()
  const service = searchParams.get('service') || 'cleaning'
  const care = searchParams.get('care') || 'normal'
  const router = useRouter()
  
  // Different durations for each service and care type combination
  const getServiceDuration = (serviceType: string, careType: string) => {
    const durations: Record<string, Record<string, number>> = {
      cleaning: {
        gentle: 180, // 3 minutes
        normal: 120, // 2 minutes
        strong: 90   // 1.5 minutes
      },
      drying: {
        gentle: 90,  // 1.5 minutes (45-60 min in production)
        normal: 60,  // 1 minute (30-40 min in production)
        strong: 45   // 45 seconds (20-30 min in production)
      },
      sterilizing: {
        gentle: 90,  // 1.5 minutes (15 min in production)
        normal: 60,  // 1 minute (10 min in production)
        strong: 120  // 2 minutes (20 min in production)
      }
    }

    return durations[serviceType.toLowerCase()]?.[careType.toLowerCase()] || 120
  }

  const totalTime = getServiceDuration(service, care)
  const [timeRemaining, setTimeRemaining] = useState(totalTime)

  const progress = ((totalTime - timeRemaining) / totalTime) * 100

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (timeRemaining === 0) {
      router.push(`/user/success/service?service=${service}&care=${care}`)
    }
  }, [timeRemaining, router, service, care])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getServiceConfig = () => {
    switch (service.toLowerCase()) {
      case 'cleaning':
        return {
          icon: <Droplets className="w-32 h-32 text-blue-600" />,
          name: 'Cleaning',
          color: 'text-blue-600'
        }
      case 'drying':
        return {
          icon: <Wind className="w-32 h-32 text-cyan-600" />,
          name: 'Drying',
          color: 'text-cyan-600'
        }
      case 'sterilizing':
        return {
          icon: <ShieldCheck className="w-32 h-32 text-green-600" />,
          name: 'Sterilizing',
          color: 'text-green-600'
        }
      default:
        return {
          icon: <Droplets className="w-32 h-32 text-blue-600" />,
          name: 'Cleaning',
          color: 'text-blue-600'
        }
    }
  }

  const getCareTypeName = () => {
    return care.charAt(0).toUpperCase() + care.slice(1)
  }

  const serviceConfig = getServiceConfig()

  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress...
      </h1>
      <div className='flex justify-center'>
        {serviceConfig.icon}
      </div>
      <h2 className="text-4xl font-bold text-center mt-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {serviceConfig.name} - {getCareTypeName()}
      </h2>
      <p className="text-center text-gray-600 mt-4">
        Please wait while we {serviceConfig.name.toLowerCase()} your shoes with {care} care. You will be notified once the process is complete.
      </p>
      <p className="text-center text-4xl font-bold text-gray-600 mt-4">
        Time Remaining: {formatTime(timeRemaining)}
      </p>
      <div className="mt-6">
        <Progress value={progress} className='bg-gray-200 relative h-2 w-full overflow-hidden rounded-full [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:via-cyan-600 [&>*]:to-green-600'/>
      </div>
    </div>
  )
}

export default CustomProgress