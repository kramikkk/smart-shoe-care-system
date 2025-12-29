'use client'

import { Droplets, ShieldCheck, Wind } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Progress } from "@/components/ui/progress"
import { Item } from '@/components/ui/item'
import { useRouter, useSearchParams } from 'next/navigation'

const Auto = () => {
  const searchParams = useSearchParams()
  const shoe = searchParams.get('shoe') || 'mesh'
  const care = searchParams.get('care') || 'normal'
  const router = useRouter()

  // Different durations for package based on care type
  const getPackageDuration = (careType: string) => {
    const durations: Record<string, number> = {
      gentle: 360, // 6 minutes (~90 min in production)
      normal: 240, // 4 minutes (~60 min in production)
      strong: 180  // 3 minutes (~45 min in production)
    }
    return durations[careType.toLowerCase()] || 240
  }

  const totalTime = getPackageDuration(care)
  const [timeRemaining, setTimeRemaining] = useState(totalTime)
  const [currentStage, setCurrentStage] = useState<'cleaning' | 'drying' | 'sterilizing'>('cleaning')

  const progress = ((totalTime - timeRemaining) / totalTime) * 100

  // Calculate stage durations based on care type
  const getStageDurations = () => {
    switch (care.toLowerCase()) {
      case 'gentle':
        return {
          cleaning: 180, // 3 minutes (first half)
          drying: 90,    // 1.5 minutes (middle)
          sterilizing: 90 // 1.5 minutes (last)
        }
      case 'strong':
        return {
          cleaning: 90,  // 1.5 minutes
          drying: 45,    // 45 seconds
          sterilizing: 45 // 45 seconds
        }
      default: // normal
        return {
          cleaning: 120, // 2 minutes
          drying: 60,    // 1 minute
          sterilizing: 60 // 1 minute
        }
    }
  }

  const stageDurations = getStageDurations()

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        
        const newTime = prev - 1
        
        // Update stage based on time remaining and care type
        const cleaningEnd = totalTime - stageDurations.cleaning
        const dryingEnd = cleaningEnd - stageDurations.drying
        
        if (newTime > cleaningEnd) {
          setCurrentStage('cleaning')
        } else if (newTime > dryingEnd) {
          setCurrentStage('drying')
        } else {
          setCurrentStage('sterilizing')
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [totalTime, stageDurations])

  useEffect(() => {
    if (timeRemaining === 0) {
      router.push(`/user/success/service?shoe=${shoe}&service=package&care=${care}`)
    }
  }, [timeRemaining, router, shoe, care])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStageIcon = () => {
    switch (currentStage) {
      case 'cleaning':
        return <Droplets className="w-32 h-32 text-cyan-600" />
      case 'drying':
        return <Wind className="w-32 h-32 text-blue-600" />
      case 'sterilizing':
        return <ShieldCheck className="w-32 h-32 text-green-600" />
    }
  }

  const getStageName = () => {
    switch (currentStage) {
      case 'cleaning':
        return 'Cleaning'
      case 'drying':
        return 'Drying'
      case 'sterilizing':
        return 'Sterilizing'
    }
  }

  const getCareTypeName = () => {
    return care.charAt(0).toUpperCase() + care.slice(1)
  }

  const getShoeTypeName = () => {
    return shoe.charAt(0).toUpperCase() + shoe.slice(1)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-4">
      {/* Title */}
      <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress
      </h1>

      {/* Main Stage Icon with Animation */}
      <div className='flex justify-center mb-4'>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 rounded-full blur-xl opacity-40 animate-pulse"></div>
          <div className="relative bg-white rounded-full p-4 shadow-xl">
            <div className="w-24 h-24 flex items-center justify-center">
              {currentStage === 'cleaning' && <Droplets className="w-20 h-20 text-cyan-600" />}
              {currentStage === 'drying' && <Wind className="w-20 h-20 text-blue-600" />}
              {currentStage === 'sterilizing' && <ShieldCheck className="w-20 h-20 text-green-600" />}
            </div>
          </div>
        </div>
      </div>

      {/* Current Stage Name */}
      <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {getStageName()}
      </h2>

      {/* Shoe Type & Care Type Badges */}
      <div className="flex gap-2 mb-4">
        <span className="inline-block px-4 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full text-sm font-semibold text-purple-800 shadow-sm">
          {getShoeTypeName()} Type
        </span>
        <span className="inline-block px-4 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full text-sm font-semibold text-blue-800 shadow-sm">
          {getCareTypeName()} Care
        </span>
      </div>

      {/* Time Remaining */}
      <div className="mb-4">
        <p className="text-lg text-gray-500 text-center mb-1">Time Remaining</p>
        <p className="text-5xl font-bold text-center bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
          {formatTime(timeRemaining)}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-xl mb-6">
        <Progress
          value={progress}
          className='bg-gray-200 relative h-4 w-full overflow-hidden rounded-full shadow-inner [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:via-cyan-600 [&>*]:to-green-600 [&>*]:transition-all [&>*]:duration-500'
        />
        <p className="text-center text-gray-500 mt-2 text-sm font-medium">{Math.round(progress)}% Complete</p>
      </div>

      {/* Process Stages Indicator */}
      <div className="w-full max-w-2xl">
        <h2 className='text-xl font-bold text-center mb-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent'>
          Process Stages
        </h2>
        <div className='flex justify-center gap-6'>
          {/* Cleaning Stage */}
          <div className="flex flex-col items-center transition-all duration-300">
            <div className={`rounded-full p-3 mb-2 transition-all duration-300 ${
              currentStage === 'cleaning'
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg scale-105'
                : 'bg-gray-200 shadow-md'
            }`}>
              <Droplets className={`w-12 h-12 transition-colors duration-300 ${
                currentStage === 'cleaning' ? 'text-white' : 'text-gray-400'
              }`} />
            </div>
            <Item className={`text-center px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
              currentStage === 'cleaning'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white/70 text-gray-600'
            }`}>
              <span className="text-sm">Cleaning</span>
            </Item>
          </div>

          {/* Drying Stage */}
          <div className="flex flex-col items-center transition-all duration-300">
            <div className={`rounded-full p-3 mb-2 transition-all duration-300 ${
              currentStage === 'drying'
                ? 'bg-gradient-to-br from-cyan-500 to-green-500 shadow-lg scale-105'
                : 'bg-gray-200 shadow-md'
            }`}>
              <Wind className={`w-12 h-12 transition-colors duration-300 ${
                currentStage === 'drying' ? 'text-white' : 'text-gray-400'
              }`} />
            </div>
            <Item className={`text-center px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
              currentStage === 'drying'
                ? 'bg-cyan-600 text-white font-bold'
                : 'bg-white/70 text-gray-600'
            }`}>
              <span className="text-sm">Drying</span>
            </Item>
          </div>

          {/* Sterilizing Stage */}
          <div className="flex flex-col items-center transition-all duration-300">
            <div className={`rounded-full p-3 mb-2 transition-all duration-300 ${
              currentStage === 'sterilizing'
                ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg scale-105'
                : 'bg-gray-200 shadow-md'
            }`}>
              <ShieldCheck className={`w-12 h-12 transition-colors duration-300 ${
                currentStage === 'sterilizing' ? 'text-white' : 'text-gray-400'
              }`} />
            </div>
            <Item className={`text-center px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
              currentStage === 'sterilizing'
                ? 'bg-green-600 text-white font-bold'
                : 'bg-white/70 text-gray-600'
            }`}>
              <span className="text-sm">Sterilizing</span>
            </Item>
          </div>
        </div>
      </div>

      {/* Instruction Text */}
      <p className="text-center text-gray-500 mt-6 text-base max-w-xl">
        Please wait while we take care of your shoes. You will be automatically redirected when complete.
      </p>
    </div>
  )
}

export default Auto