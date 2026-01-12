'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/contexts/WebSocketContext'

type ClassificationState = 'connecting' | 'classifying' | 'success' | 'error'

export default function ClassifyPage() {
  const router = useRouter()
  const { isConnected, deviceId, sendMessage, subscribe, onMessage } = useWebSocket()
  const [state, setState] = useState<ClassificationState>('connecting')
  const [result, setResult] = useState<{ shoeType: string; confidence: number } | null>(null)
  const [error, setError] = useState<string>('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const classificationSentRef = useRef<boolean>(false) // Prevent duplicate requests

  useEffect(() => {
    if (!deviceId || deviceId === 'No device configured') {
      setError('Device not configured')
      setState('error')
      return
    }

    // Derive CAM device ID for subscription
    const camDeviceId = deviceId.replace('SSCM-', 'SSCM-CAM-')

    // Wait for WebSocket to be connected
    if (!isConnected) {
      setState('connecting')
      return
    }

    // Prevent duplicate classification requests
    if (classificationSentRef.current) {
      console.log('[Classify] Classification already requested, skipping')
      return
    }

    console.log('[Classify] WebSocket connected, subscribing to devices')

    // Subscribe to both main device and CAM device
    subscribe(deviceId)
    subscribe(camDeviceId)

    // Small delay then send classification request
    setTimeout(() => {
      if (isConnected && !classificationSentRef.current) {
        classificationSentRef.current = true
        setState('classifying')
        sendMessage({
          type: 'start-classification',
          deviceId: deviceId
        })
        console.log('[Classify] Classification request sent')

        // Set timeout for classification (30 seconds)
        timeoutRef.current = setTimeout(() => {
          if (state === 'classifying') {
            setError('Classification timed out. Please try again.')
            setState('error')
          }
        }, 30000)
      }
    }, 500)

    // Register message handler
    const unsubscribe = onMessage((message) => {
      console.log('[Classify] Received:', message)

      if (message.type === 'classification-result') {
        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        setResult({
          shoeType: message.result,
          confidence: message.confidence
        })
        setState('success')
      }
      else if (message.type === 'classification-started') {
        console.log('[Classify] Classification started on CAM')
      }
      else if (message.type === 'classification-error') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        setError(message.error || 'Classification failed')
        setState('error')
      }
      else if (message.type === 'classification-busy') {
        setError('Classification system is busy. Please wait.')
        setState('error')
      }
    })

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      unsubscribe()
    }
  }, [isConnected, deviceId, sendMessage, subscribe, onMessage, router]) // Removed 'state' to prevent re-triggering

  const handleRetry = () => {
    classificationSentRef.current = false // Reset the flag
    setState('connecting')
    setError('')
    setResult(null)
    
    if (!deviceId || deviceId === 'No device configured') {
      setError('Device not configured')
      setState('error')
      return
    }

    // Restart classification process
    setTimeout(() => {
      if (isConnected && !classificationSentRef.current) {
        classificationSentRef.current = true
        setState('classifying')
        sendMessage({
          type: 'start-classification',
          deviceId: deviceId
        })
        console.log('[Classify] Classification request sent (retry)')

        timeoutRef.current = setTimeout(() => {
          if (state === 'classifying') {
            setError('Classification timed out. Please try again.')
            setState('error')
          }
        }, 30000)
      }
    }, 500)
  }

  const handleProceedToPayment = () => {
    if (result) {
      router.replace(`/user/payment?service=package&shoe=${encodeURIComponent(result.shoeType)}&care=normal`)
    }
  }

  const handleCancel = () => {
    router.push('/user/mode')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Title */}
      <h1 className="text-5xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Shoe Classification
      </h1>

      {/* Status Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          {state === 'connecting' && (
            <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-gray-400 animate-spin" />
            </div>
          )}
          {state === 'classifying' && (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center animate-pulse">
              <Camera className="w-16 h-16 text-white" />
            </div>
          )}
          {state === 'success' && (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-white" />
            </div>
          )}
          {state === 'error' && (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <AlertCircle className="w-16 h-16 text-white" />
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="mb-6">
          {state === 'connecting' && (
            <>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">Connecting...</h2>
              <p className="text-gray-500">Setting up camera connection</p>
            </>
          )}
          {state === 'classifying' && (
            <>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">Analyzing Shoe...</h2>
              <p className="text-gray-500">Please wait while we identify your shoe type</p>
              <div className="mt-4 flex justify-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </>
          )}
          {state === 'success' && result && (
            <>
              <h2 className="text-2xl font-bold text-green-600 mb-2">Shoe Detected!</h2>
              <p className="text-3xl font-bold text-gray-800 capitalize mb-1">
                {result.shoeType}
              </p>
              <p className="text-gray-500">
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </p>
            </>
          )}
          {state === 'error' && (
            <>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Classification Failed</h2>
              <p className="text-gray-500">{error}</p>
            </>
          )}
        </div>

        {/* Buttons */}
        {state === 'success' && (
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="px-6 py-3"
            >
              Retry Classification
            </Button>
            <Button
              onClick={handleProceedToPayment}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              Proceed to Payment
            </Button>
          </div>
        )}
        {state === 'error' && (
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="px-6 py-3"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRetry}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      {(state === 'connecting' || state === 'classifying') && (
        <p className="mt-8 text-gray-500 text-center max-w-md">
          Please ensure your shoe is placed in the scanning area and the camera has a clear view.
        </p>
      )}
    </div>
  )
}
