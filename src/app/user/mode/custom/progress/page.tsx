'use client'

import { Droplets, ShieldCheck, Wind } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Progress } from "@/components/ui/progress"
import { useSearchParams } from 'next/navigation'

const CustomProgress = () => {
  const searchParams = useSearchParams()
  const service = searchParams.get('service') || 'cleaning'
  
  // Different durations for each service
  const getServiceDuration = (serviceType: string) => {
    switch (serviceType.toLowerCase()) {
      case 'cleaning':
        return 120 // 2 minutes
      case 'drying':
        return 60 // 1 minute
      case 'sterilizing':
        return 120 // 2 minutes
      default:
        return 180
    }
  }

  const totalTime = getServiceDuration(service)
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
        {serviceConfig.name}
      </h2>
      <p className="text-center text-gray-600 mt-4">
        Please wait while we {serviceConfig.name.toLowerCase()} your shoes. You will be notified once the process is complete.
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