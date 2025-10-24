'use client'

import { Droplets, ShieldCheck, Wind } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Progress } from "@/components/ui/progress"
import { Item } from '@/components/ui/item'
import { useRouter } from 'next/navigation'

const Auto = () => {
  const totalTime = 300 // 5 minutes in seconds
  const [timeRemaining, setTimeRemaining] = useState(totalTime)
  const [currentStage, setCurrentStage] = useState<'cleaning' | 'drying' | 'sterilizing'>('cleaning')
  const router = useRouter()

  const progress = ((totalTime - timeRemaining) / totalTime) * 100

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        
        const newTime = prev - 1
        
        // Update stage based on time remaining
        // Cleaning: 300-180 (2 minutes)
        // Drying: 181-61 (1 minutes)
        // Sterilizing: 120-0 (2 minutes)
        if (newTime > 180) {
          setCurrentStage('cleaning')
        } else if (newTime > 120) {
          setCurrentStage('drying')
        } else {
          setCurrentStage('sterilizing')
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (timeRemaining === 0) {
      router.push('/user/success/service?service=package')
    }
  }, [timeRemaining, router])

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

  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress...
      </h1>
      <div className='flex justify-center'>
        {getStageIcon()}
      </div>
      <h2 className="text-4xl font-bold text-center mt-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {getStageName()}
      </h2>
      <p className="text-center text-gray-600 mt-4">
        Please wait while we take care of your shoes. You will be notified once the process is complete.
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