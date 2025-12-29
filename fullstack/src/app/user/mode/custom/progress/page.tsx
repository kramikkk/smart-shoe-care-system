'use client'

import { Droplets, ShieldCheck, Wind } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Progress } from "@/components/ui/progress"
import { useSearchParams, useRouter } from 'next/navigation'

const CustomProgress = () => {
  const searchParams = useSearchParams()
  const shoe = searchParams.get('shoe') || 'mesh'
  const service = searchParams.get('service') || 'cleaning'
  const care = searchParams.get('care') || 'normal'
  const router = useRouter()
  
  // Different durations for each service and care type combination
  const getServiceDuration = (serviceType: string, careType: string) => {
    const durations: Record<string, Record<string, number>> = {
      cleaning: {
        gentle: 180,
        normal: 180,
        strong: 180 
      },
      drying: {
        gentle: 60, 
        normal: 120, 
        strong: 180
      },
      sterilizing: {
        gentle: 60,
        normal: 120, 
        strong: 180 
      }
    }

    return durations[serviceType.toLowerCase()]?.[careType.toLowerCase()] || 120
  }

  const [timeRemaining, setTimeRemaining] = useState(() => getServiceDuration(service, care))
  const totalTime = getServiceDuration(service, care)

  const progress = ((totalTime - timeRemaining) / totalTime) * 100

  // Reset timer when service or care parameters change
  useEffect(() => {
    const newDuration = getServiceDuration(service, care)
    setTimeRemaining(newDuration)
  }, [service, care])

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
  }, [service, care])

  useEffect(() => {
    if (timeRemaining === 0) {
      router.push(`/user/success/service?shoe=${shoe}&service=${service}&care=${care}`)
    }
  }, [timeRemaining, router, shoe, service, care])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getServiceConfig = () => {
    switch (service.toLowerCase()) {
      case 'cleaning':
        return {
          icon: <Droplets className="w-24 h-24 text-blue-600" />,
          name: 'Cleaning',
          color: 'text-blue-600',
          gradientFrom: 'from-blue-400',
          gradientTo: 'to-cyan-400'
        }
      case 'drying':
        return {
          icon: <Wind className="w-24 h-24 text-cyan-600" />,
          name: 'Drying',
          color: 'text-cyan-600',
          gradientFrom: 'from-cyan-400',
          gradientTo: 'to-blue-400'
        }
      case 'sterilizing':
        return {
          icon: <ShieldCheck className="w-24 h-24 text-green-600" />,
          name: 'Sterilizing',
          color: 'text-green-600',
          gradientFrom: 'from-green-400',
          gradientTo: 'to-emerald-400'
        }
      default:
        return {
          icon: <Droplets className="w-24 h-24 text-blue-600" />,
          name: 'Cleaning',
          color: 'text-blue-600',
          gradientFrom: 'from-blue-400',
          gradientTo: 'to-cyan-400'
        }
    }
  }

  const getCareTypeName = () => {
    return care.charAt(0).toUpperCase() + care.slice(1)
  }

  const getShoeTypeName = () => {
    return shoe.charAt(0).toUpperCase() + shoe.slice(1)
  }

  const serviceConfig = getServiceConfig()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-6">
      {/* Title */}
      <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress
      </h1>

      {/* Service Icon with Animation */}
      <div className='flex justify-center mb-6'>
        <div className="relative">
          <div className={`absolute inset-0 bg-gradient-to-r ${serviceConfig.gradientFrom} ${serviceConfig.gradientTo} rounded-full blur-xl opacity-40 animate-pulse`}></div>
          <div className="relative bg-white rounded-full p-6 shadow-xl">
            <div className="w-28 h-28 flex items-center justify-center">
              {serviceConfig.icon}
            </div>
          </div>
        </div>
      </div>

      {/* Service Name */}
      <h2 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {serviceConfig.name}
      </h2>

      {/* Shoe Type & Care Type Badges */}
      <div className="flex gap-3 mb-6">
        <span className="inline-block px-5 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full text-base font-semibold text-purple-800 shadow-sm">
          {getShoeTypeName()} Type
        </span>
        <span className="inline-block px-5 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full text-base font-semibold text-blue-800 shadow-sm">
          {getCareTypeName()} Care
        </span>
      </div>

      {/* Time Remaining */}
      <div className="mb-6">
        <p className="text-xl text-gray-500 text-center mb-1">Time Remaining</p>
        <p className="text-6xl font-bold text-center bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
          {formatTime(timeRemaining)}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-xl mb-6">
        <Progress
          value={progress}
          className='bg-gray-200 relative h-5 w-full overflow-hidden rounded-full shadow-inner [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:via-cyan-600 [&>*]:to-green-600 [&>*]:transition-all [&>*]:duration-500'
        />
        <p className="text-center text-gray-500 mt-2 text-base font-medium">{Math.round(progress)}% Complete</p>
      </div>

      {/* Instruction Text */}
      <p className="text-center text-gray-500 text-lg max-w-xl leading-relaxed">
        Please wait while we take care of your shoes. You will be automatically redirected when complete.
      </p>
    </div>
  )
}

export default CustomProgress