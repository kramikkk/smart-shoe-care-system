'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, CheckCircle, AlertCircle, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/contexts/WebSocketContext'

type ClassificationState = 'connecting' | 'syncing' | 'classifying' | 'success' | 'error'

export default function ClassifyPage() {
  const router = useRouter()
  const { isConnected, deviceId, sendMessage, subscribe, onMessage } = useWebSocket()
  const [state, setState] = useState<ClassificationState>('connecting')
  const [camSynced, setCamSynced] = useState<boolean>(false)
  const [hasReceivedSyncStatus, setHasReceivedSyncStatus] = useState<boolean>(false) // Track if we've received initial sync status
  const [result, setResult] = useState<{ shoeType: string; confidence: number } | null>(null)
  const [error, setError] = useState<string>('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const classificationSentRef = useRef<boolean>(false) // Prevent duplicate requests
  const subscriptionsSetRef = useRef<boolean>(false) // Track if subscriptions are set up

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

    // Set up subscriptions and enable LED only once
    if (!subscriptionsSetRef.current) {
      subscriptionsSetRef.current = true
      console.log('[Classify] WebSocket connected, subscribing to devices')

      // Subscribe to both main device and CAM device
      subscribe(deviceId)
      subscribe(camDeviceId)
    }

    // Always send enable-classification when connected (turns LED white)
    // This ensures LED is on even if CAM isn't synced yet
    sendMessage({
      type: 'enable-classification',
      deviceId: deviceId
    })
    console.log('[Classify] Classification LED enabled (white)')

    // Wait for initial sync status before deciding whether to show syncing state
    if (!hasReceivedSyncStatus) {
      setState('connecting')
      console.log('[Classify] Waiting for initial CAM sync status...')
      return
    }

    // Check if CAM is synced via ESP-NOW
    if (!camSynced) {
      setState('syncing')
      console.log('[Classify] CAM not synced yet, waiting...')
      return
    }

    // Prevent duplicate classification requests
    if (classificationSentRef.current) {
      console.log('[Classify] Classification already requested, skipping')
      return
    }

    console.log('[Classify] CAM synced, starting classification')

    // Small delay then send classification request
    setTimeout(() => {
      if (isConnected && camSynced && !classificationSentRef.current) {
        classificationSentRef.current = true
        setState('classifying')
        sendMessage({
          type: 'start-classification',
          deviceId: deviceId
        })
        console.log('[Classify] Classification request sent')

        // Set timeout for classification (15 seconds - same as hardware timeout)
        timeoutRef.current = setTimeout(() => {
          setState((currentState) => {
            if (currentState === 'classifying') {
              setError('Classification timed out. Please try again.')
              return 'error'
            }
            return currentState
          })
        }, 15000)
      }
    }, 500)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isConnected, deviceId, sendMessage, subscribe, camSynced, hasReceivedSyncStatus])

  // Store refs for cleanup to avoid dependency issues
  const deviceIdRef = useRef(deviceId)
  const sendMessageRef = useRef(sendMessage)
  const isConnectedRef = useRef(isConnected)

  // Keep refs updated
  useEffect(() => {
    deviceIdRef.current = deviceId
    sendMessageRef.current = sendMessage
    isConnectedRef.current = isConnected
  }, [deviceId, sendMessage, isConnected])

  // Separate effect for message handling
  useEffect(() => {
    if (!isConnected || !deviceId) return

    // Register message handler
    const unsubscribe = onMessage((message) => {
      console.log('[Classify] Received:', message)

      // Handle CAM sync status from sensor-data or cam-sync-status messages
      if (message.type === 'sensor-data' && message.camSynced !== undefined) {
        console.log('[Classify] CAM sync status from sensor-data:', message.camSynced)
        setCamSynced(message.camSynced)
        setHasReceivedSyncStatus(true)
      }
      else if (message.type === 'cam-sync-status') {
        console.log('[Classify] CAM sync status:', message.camSynced)
        setCamSynced(message.camSynced)
        setHasReceivedSyncStatus(true)
      }
      else if (message.type === 'classification-result') {
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
      unsubscribe()
    }
  }, [isConnected, deviceId, onMessage])

  // Cleanup effect for when leaving the page (only runs on unmount)
  useEffect(() => {
    return () => {
      // Disable classification LED when leaving page
      if (isConnectedRef.current && deviceIdRef.current) {
        sendMessageRef.current({
          type: 'disable-classification',
          deviceId: deviceIdRef.current
        })
        console.log('[Classify] Classification page exited, LED disabled')
      }
    }
  }, []) // Empty deps - only runs on mount/unmount

  const handleRetry = () => {
    // Clear timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Reset states immediately for instant visual feedback
    classificationSentRef.current = false
    setError('')
    setResult(null)

    if (!deviceId || deviceId === 'No device configured') {
      setError('Device not configured')
      setState('error')
      return
    }

    // If CAM not synced, go back to syncing state
    if (!camSynced) {
      setState('syncing')
      return
    }

    // Update to classifying state immediately
    setState('classifying')

    // Send classification request immediately
    if (isConnected && camSynced && !classificationSentRef.current) {
      classificationSentRef.current = true
      sendMessage({
        type: 'start-classification',
        deviceId: deviceId
      })
      console.log('[Classify] Classification request sent (retry)')

      // Set timeout for classification (15 seconds)
      timeoutRef.current = setTimeout(() => {
        setState((currentState) => {
          if (currentState === 'classifying') {
            setError('Classification timed out. Please try again.')
            return 'error'
          }
          return currentState
        })
      }, 15000)
    }
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
          {state === 'syncing' && (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center animate-pulse">
              <WifiOff className="w-16 h-16 text-white" />
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
          {state === 'syncing' && (
            <>
              <h2 className="text-2xl font-bold text-amber-600 mb-2">Camera Not Synced</h2>
              <p className="text-gray-500">Waiting for camera module to connect...</p>
              <div className="mt-4 flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-amber-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-400">
                The camera module is syncing via ESP-NOW. This usually takes a few seconds.
              </p>
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
        {state === 'syncing' && (
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="px-6 py-3"
            >
              Cancel
            </Button>
          </div>
        )}
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
      {state === 'syncing' && (
        <div className="mt-8 text-center max-w-md">
          <p className="text-amber-600 font-medium mb-2">
            Please wait while the camera syncs...
          </p>
          <p className="text-gray-400 text-sm">
            Classification will start automatically once the camera is ready.
          </p>
        </div>
      )}
    </div>
  )
}
