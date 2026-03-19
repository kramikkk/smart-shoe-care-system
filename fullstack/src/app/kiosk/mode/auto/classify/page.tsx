'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, CheckCircle, AlertCircle, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { debug } from '@/lib/debug'
import { StepIndicator } from '@/components/kiosk/StepIndicator'
import { AUTO_STEPS } from '@/lib/kiosk-constants'

type ClassificationState = 'connecting' | 'syncing' | 'classifying' | 'success' | 'error'

type ClassificationResult = {
  shoeType: 'mesh' | 'canvas' | 'rubber' | 'invalid' | 'no_shoe'
  confidence: number // -1 = manually selected
  subCategory?: string
  condition?: 'normal' | 'too_dirty'
}

const VALID_SHOE_TYPES = ['mesh', 'canvas', 'rubber'] as const

export default function ClassifyPage() {
  const router = useRouter()
  const { isConnected, deviceId, sendMessage, subscribe, onMessage } = useWebSocket()
  const [state, setState] = useState<ClassificationState>('connecting')
  const [camSynced, setCamSynced] = useState<boolean>(false)
  const [hasReceivedSyncStatus, setHasReceivedSyncStatus] = useState<boolean>(false)
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string>('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const classificationSentRef = useRef<boolean>(false)
  const subscriptionsSetRef = useRef<boolean>(false)
  const hasResultRef = useRef<boolean>(false)
  const syncDelayRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!deviceId || deviceId === 'No device configured') {
      setError('Device not configured')
      setState('error')
      return
    }

    if (!isConnected) {
      setState('connecting')
      return
    }

    if (!subscriptionsSetRef.current) {
      subscriptionsSetRef.current = true
      subscribe(deviceId)
    }

    debug.log(`[Classify] Sending enable-classification — device: ${deviceId}, camSynced: ${camSynced}`)
    sendMessage({ type: 'enable-classification', deviceId: deviceId })

    if (!hasReceivedSyncStatus) {
      setState('connecting')
      return
    }

    if (!camSynced) {
      setState('syncing')
      return
    }

    if (classificationSentRef.current) {
      return
    }

    syncDelayRef.current = setTimeout(() => {
      if (isConnected && camSynced && !classificationSentRef.current) {
        classificationSentRef.current = true
        setState('classifying')
        console.log('[Classify] Sending start-classification')
        sendMessage({ type: 'start-classification', deviceId: deviceId })

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
      if (syncDelayRef.current) {
        clearTimeout(syncDelayRef.current)
        syncDelayRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isConnected, deviceId, sendMessage, subscribe, camSynced, hasReceivedSyncStatus])

  const deviceIdRef = useRef(deviceId)
  const sendMessageRef = useRef(sendMessage)
  const isConnectedRef = useRef(isConnected)

  useEffect(() => {
    deviceIdRef.current = deviceId
    sendMessageRef.current = sendMessage
    isConnectedRef.current = isConnected
  }, [deviceId, sendMessage, isConnected])

  useEffect(() => {
    if (!isConnected || !deviceId) return

    const unsubscribe = onMessage((message) => {
      if (message.type === 'sensor-data' && message.camSynced !== undefined) {
        debug.log(`[Classify] sensor-data — camSynced: ${message.camSynced}`)
        setCamSynced(message.camSynced)
        setHasReceivedSyncStatus(true)
      }
      else if (message.type === 'cam-sync-status') {
        debug.log(`[Classify] cam-sync-status — camSynced: ${message.camSynced}`)
        setCamSynced(message.camSynced)
        setHasReceivedSyncStatus(true)
      }
      else if (message.type === 'classification-result') {
        debug.log(`[Classify] Result — type: ${message.result}, confidence: ${(message.confidence * 100).toFixed(1)}%, condition: ${message.condition}`)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        hasResultRef.current = true
        setResult({
          shoeType: message.result as ClassificationResult['shoeType'],
          confidence: message.confidence,
          subCategory: message.subCategory ?? '',
          condition: message.condition === 'too_dirty' ? 'too_dirty' : 'normal',
        })
        setShowPicker(false)
        setState('success')
      }
      else if (message.type === 'classification-error') {
        if (hasResultRef.current) return  // already have a result — ignore late error from main board
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        debug.error(`[Classify] Error — ${message.error}`)
        setError(message.error || 'Classification failed')
        setState('error')
      }
      else if (message.type === 'classification-busy') {
        debug.warn('[Classify] Classification system busy')
        setError('Classification system is busy. Please wait.')
        setState('error')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isConnected, deviceId, onMessage])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (syncDelayRef.current) clearTimeout(syncDelayRef.current)
      if (isConnectedRef.current && deviceIdRef.current) {
        sendMessageRef.current({
          type: 'disable-classification',
          deviceId: deviceIdRef.current
        })
      }
    }
  }, [])

  const handleRetry = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    classificationSentRef.current = false
    hasResultRef.current = false
    setError('')
    setResult(null)
    setShowPicker(false)

    if (!deviceId || deviceId === 'No device configured') {
      setError('Device not configured')
      setState('error')
      return
    }

    if (!camSynced) {
      setState('syncing')
      return
    }

    setState('classifying')

    if (isConnected && camSynced && !classificationSentRef.current) {
      classificationSentRef.current = true
      sendMessage({ type: 'start-classification', deviceId: deviceId })

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

  const handleManualSelect = (shoeType: 'mesh' | 'canvas' | 'rubber') => {
    debug.log(`[Classify] Manual shoe type selected: ${shoeType}`)
    setResult({ shoeType, confidence: -1 })
    setShowPicker(false)
  }

  const handleProceedToPayment = () => {
    if (result && VALID_SHOE_TYPES.includes(result.shoeType as typeof VALID_SHOE_TYPES[number])) {
      router.replace(`/kiosk/payment?service=package&shoe=${encodeURIComponent(result.shoeType)}`)
    }
  }

  const handleCancel = () => {
    router.push('/kiosk/mode')
  }

  const isValidShoeType = result && VALID_SHOE_TYPES.includes(result.shoeType as typeof VALID_SHOE_TYPES[number])
  const canProceed = isValidShoeType && result?.condition !== 'too_dirty'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <StepIndicator steps={AUTO_STEPS} currentStep={1} />

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
          {state === 'success' && result && (
            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
              isValidShoeType
                ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                : 'bg-gradient-to-br from-amber-400 to-orange-500'
            }`}>
              {isValidShoeType
                ? <CheckCircle className="w-16 h-16 text-white" />
                : <AlertCircle className="w-16 h-16 text-white" />
              }
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
          {state === 'success' && result && !showPicker && (
            <>
              {isValidShoeType && (
                <>
                  <h2 className="text-2xl font-bold text-green-600 mb-2">Shoe Detected!</h2>
                  <p className="text-3xl font-bold text-gray-800 capitalize mb-1">
                    {result.shoeType}
                  </p>
                  {result.subCategory && (
                    <p className="text-lg text-gray-600 mb-1">{result.subCategory}</p>
                  )}
                  <p className="text-gray-500">
                    Confidence: {result.confidence === -1 ? 'Manual' : `${(result.confidence * 100).toFixed(1)}%`}
                  </p>
                  {result.condition && (
                    <>
                      {result.condition === 'too_dirty' ? (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-700 font-semibold text-sm">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          Too Dirty
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          Normal Condition
                        </div>
                      )}
                      {result.condition === 'too_dirty' && (
                        <p className="mt-3 text-sm text-red-600">
                          The shoe is too heavily soiled for our system. Please remove excessive mud or dirt before trying again.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              {result.shoeType === 'no_shoe' && (
                <>
                  <h2 className="text-2xl font-bold text-amber-600 mb-2">No Shoe Detected</h2>
                  <p className="text-gray-500">Please place your shoe in the chamber and try again.</p>
                  {result.confidence > 0 && (
                    <p className="text-sm text-gray-400 mt-1">
                      Confidence: {(result.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </>
              )}
              {result.shoeType === 'invalid' && (
                <>
                  <h2 className="text-2xl font-bold text-amber-600 mb-2">Unsupported Shoe Type</h2>
                  {result.subCategory && (
                    <p className="text-lg font-semibold text-gray-700 mb-1">{result.subCategory}</p>
                  )}
                  <p className="text-gray-500">This shoe type is not supported. Our machine cleans mesh, canvas, and rubber shoes only.</p>
                  {result.confidence > 0 && (
                    <p className="text-sm text-gray-400 mt-1">
                      Confidence: {(result.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {state === 'success' && showPicker && (
            <>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">Select Shoe Type</h2>
              <p className="text-gray-500 mb-4">Choose the material of your shoe:</p>
              <div className="flex flex-col gap-3 w-full">
                {(['mesh', 'canvas', 'rubber'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleManualSelect(type)}
                    className="w-full py-4 rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-xl font-semibold text-gray-700 capitalize"
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Back
              </button>
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
        {state === 'connecting' && (
          <div className="flex gap-4 justify-center">
            <Button onClick={handleCancel} variant="outline" className="px-6 py-3">
              Cancel
            </Button>
          </div>
        )}
        {state === 'syncing' && (
          <div className="flex gap-4 justify-center">
            <Button onClick={handleCancel} variant="outline" className="px-6 py-3">
              Cancel
            </Button>
          </div>
        )}
        {state === 'classifying' && (
          <div className="flex gap-4 justify-center">
            <Button onClick={handleCancel} variant="outline" className="px-6 py-3">
              Cancel
            </Button>
          </div>
        )}
        {state === 'success' && result && !showPicker && (
          <div className="flex gap-4 justify-center">
            <Button onClick={handleCancel} variant="outline" className="px-6 py-3">
              Cancel
            </Button>
            <Button
              onClick={handleRetry}
              variant={canProceed ? 'outline' : 'default'}
              className={canProceed ? 'px-6 py-3' : 'px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white'}
            >
              Retry
            </Button>
            {canProceed && (
              <Button
                onClick={handleProceedToPayment}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                Proceed
              </Button>
            )}
          </div>
        )}
        {state === 'error' && (
          <div className="flex gap-4 justify-center">
            <Button onClick={handleCancel} variant="outline" className="px-6 py-3">
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
