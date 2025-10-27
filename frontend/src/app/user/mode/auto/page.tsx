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

  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress...
      </h1>
      <div className='flex justify-center'>
        {getStageIcon()}
      </div>
      <h2 className="text-4xl font-bold text-center mt-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {getStageName()} - {getCareTypeName()} Care
      </h2>
      <p className="text-center text-gray-600 mt-4">
        Please wait while we take care of your shoes with {care} care settings. You will be notified once the process is complete.
      </p>
      <p className="text-center text-4xl font-bold text-gray-600 mt-4">
        Time Remaining: {formatTime(timeRemaining)}
      </p>
      <div className="mt-6">
        <Progress value={progress} className='bg-gray-200 relative h-2 w-full overflow-hidden rounded-full [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:via-cyan-600 [&>*]:to-green-600'/>
      </div>
      <h2 className='text-2xl font-bold text-center mt-8 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent'>Process Stage:</h2>
      <div className='mt-4 flex justify-center'>
        <div>
          <Droplets className={`w-16 h-16 mx-auto ${currentStage === 'cleaning' ? 'text-blue-600' : 'text-gray-400'}`} />
          <Item className={`text-center px-6 py-3 mt-2 rounded-full shadow-lg flex flex-col items-center ${currentStage === 'cleaning' ? 'bg-blue-600/50' : 'bg-white/50'}`}>
            Cleaning
          </Item>
        </div>
        <div className='mx-12'>
          <Wind className={`w-16 h-16 mx-auto ${currentStage === 'drying' ? 'text-cyan-600' : 'text-gray-400'}`} />
          <Item className={`text-center px-6 py-3 mt-2 rounded-full shadow-lg flex flex-col items-center ${currentStage === 'drying' ? 'bg-cyan-600/50' : 'bg-white/50'}`}>
            Drying
          </Item>
        </div>
        <div>
          <ShieldCheck className={`w-16 h-16 mx-auto ${currentStage === 'sterilizing' ? 'text-green-600' : 'text-gray-400'}`} />
          <Item className={`text-center px-6 py-3 mt-2 rounded-full shadow-lg flex flex-col items-center ${currentStage === 'sterilizing' ? 'bg-green-600/50' : 'bg-white/50'}`}>
            Sterilizing
          </Item>
        </div>
      </div>
    </div>
  )
}

export default Auto