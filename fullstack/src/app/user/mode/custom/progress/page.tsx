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
        gentle: 300,
        normal: 300,
        strong: 300 
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
  const [wsConnected, setWsConnected] = useState(false)
  const [serviceStarted, setServiceStarted] = useState(false)

  const progress = ((totalTime - timeRemaining) / totalTime) * 100

  // Reset timer when service or care parameters change
  useEffect(() => {
    const newDuration = getServiceDuration(service, care)
    setTimeRemaining(newDuration)
  }, [service, care])

  // WebSocket connection to send start-service command and receive updates
  useEffect(() => {
    const deviceId = localStorage.getItem('kiosk_device_id')
    if (!deviceId) return

    let ws: WebSocket | null = null
    let isCleanedUp = false

    const connect = () => {
      if (isCleanedUp) return

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws?deviceId=${encodeURIComponent(deviceId)}`
      
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (isCleanedUp) {
          ws?.close()
          return
        }
        
        setWsConnected(true)
        ws!.send(JSON.stringify({ type: 'subscribe', deviceId }))

        // Send start-service command to ESP32 (only if not already started)
        if (!serviceStarted) {
          ws!.send(JSON.stringify({
            type: 'start-service',
            deviceId,
            shoeType: shoe,
            serviceType: service,
            careType: care
          }))
          setServiceStarted(true)
          console.log(`[Progress] Service started: ${service} (${care})`)
        }
      }

      ws.onmessage = (event) => {
        if (isCleanedUp) return
        
        try {
          const message = JSON.parse(event.data)

          // Handle service status updates from ESP32
          if (message.type === 'service-status') {
            console.log(`[Progress] Status update: ${message.progress}% complete, ${message.timeRemaining}s remaining`)
            setTimeRemaining(message.timeRemaining)
          }

          // Handle service complete notification
          else if (message.type === 'service-complete') {
            console.log(`[Progress] Service complete!`)
            setTimeRemaining(0)
          }
        } catch (error) {
          console.error('[Progress] Error parsing message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[Progress] WebSocket error:', error)
        if (!isCleanedUp) setWsConnected(false)
      }
      
      ws.onclose = () => {
        if (!isCleanedUp) {
          console.log('[Progress] WebSocket closed')
          setWsConnected(false)
        }
      }
    }

    // Small delay to avoid race condition with React StrictMode double-mounting
    const timer = setTimeout(connect, 100)

    return () => {
      isCleanedUp = true
      clearTimeout(timer)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    }
  }, [shoe, service, care])

  // Fallback local timer (in case WebSocket is not available)
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
          icon: Droplets,
          name: 'Cleaning',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-cyan-500'
        }
      case 'drying':
        return {
          icon: Wind,
          name: 'Drying',
          gradientFrom: 'from-cyan-500',
          gradientTo: 'to-green-500'
        }
      case 'sterilizing':
        return {
          icon: ShieldCheck,
          name: 'Sterilizing',
          gradientFrom: 'from-green-500',
          gradientTo: 'to-emerald-500'
        }
      default:
        return {
          icon: Droplets,
          name: 'Cleaning',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-cyan-500'
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
  const ServiceIcon = serviceConfig.icon

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      {/* Title */}
      <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Care in Progress
      </h1>

      {/* Service Icon */}
      <div className='flex justify-center mb-4'>
        <div className="flex flex-col items-center transition-all duration-300">
          <div className={`rounded-full p-4 transition-all duration-300 bg-gradient-to-br ${serviceConfig.gradientFrom} ${serviceConfig.gradientTo} shadow-lg scale-105`}>
            <ServiceIcon className="w-20 h-20 transition-colors duration-300 text-white" />
          </div>
        </div>
      </div>

      {/* Service Name */}
      <h2 className="text-4xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        {serviceConfig.name}
      </h2>

      {/* Shoe Type & Care Type Badges */}
      <div className="flex gap-3 mb-4">
        <span className="inline-block px-5 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full text-base font-semibold text-purple-800 shadow-sm">
          {getShoeTypeName()} Type
        </span>
        <span className="inline-block px-5 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full text-base font-semibold text-blue-800 shadow-sm">
          {getCareTypeName()} Care
        </span>
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={`w-2 h-2 rounded-full ${wsConnected && serviceStarted ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
        <p className="text-xs text-gray-600">
          {wsConnected && serviceStarted ? 'Connected to device' : 'Connecting...'}
        </p>
      </div>

      {/* Time Remaining */}
      <div className="mb-6">
        <p className="text-xl text-gray-500 text-center mb-1">Time Remaining</p>
        <p className="text-6xl font-bold text-center bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
          {formatTime(timeRemaining)}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl mb-6">
        <Progress
          value={progress}
          className='bg-gray-200 relative h-5 w-full overflow-hidden rounded-full shadow-inner [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:via-cyan-600 [&>*]:to-green-600 [&>*]:transition-all [&>*]:duration-500'
        />
        <p className="text-center text-gray-500 mt-2 text-base font-medium">{Math.round(progress)}% Complete</p>
      </div>

      {/* Instruction Text */}
      <p className="text-center text-gray-500 text-lg max-w-2xl leading-relaxed">
        Please wait while we take care of your shoes. You will be automatically redirected when complete.
      </p>
    </div>
  )
}

export default CustomProgress