'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, ArrowLeft, TestTube } from 'lucide-react'

type ServiceType = 'cleaning' | 'drying' | 'sterilizing' | 'package'

interface Service {
  id: ServiceType
  name: string
  description: string
  price: number
}

const services: Service[] = [
  {
    id: 'cleaning',
    name: 'Cleaning',
    description: 'Professional shoe cleaning',
    price: 45
  },
  {
    id: 'drying',
    name: 'Drying',
    description: 'Quick and effective drying',
    price: 45
  },
  {
    id: 'sterilizing',
    name: 'Sterilizing',
    description: 'UV sterilization treatment',
    price: 25
  },
  {
    id: 'package',
    name: 'Package',
    description: 'Complete care: cleaning, drying, and sterilizing',
    price: 100
  }
]

const OnlinePayment = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedService = searchParams.get('service') as ServiceType || 'cleaning'
  const selectedCare = searchParams.get('care') || 'normal'

  // Ref to prevent multiple payment creations
  const isCreatingPayment = useRef(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get selected service data
  const selectedServiceData = useMemo(() => {
    return services.find(s => s.id === selectedService) || services[0]
  }, [selectedService])

  // PayMongo API States
  const [paymentState, setPaymentState] = useState<'idle' | 'creating' | 'awaiting_payment' | 'checking' | 'success' | 'failed'>('idle')
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkPaymentStatus = useCallback(async (intentId: string) => {
    try {
      const response = await fetch(`/api/payment/status?paymentIntentId=${intentId}`)
      const data = await response.json()

      if (data.success) {
        if (data.status === 'succeeded') {
          // Redirect immediately to success page with service and care
          router.push(`/user/success/payment?service=${selectedService}&care=${selectedCare}`)
          return true
        } else if (data.status === 'failed') {
          setPaymentState('failed')
          setError('Payment failed. Please try again.')
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Status check error:', error)
      return false
    }
  }, [router, selectedService, selectedCare])

  const startPolling = useCallback((intentId: string) => {
    // Clear any existing intervals
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const pollInterval = setInterval(async () => {
      const isComplete = await checkPaymentStatus(intentId)
      if (isComplete) {
        clearInterval(pollInterval)
        pollIntervalRef.current = null
      }
    }, 3000) // Check every 3 seconds

    pollIntervalRef.current = pollInterval

    // Cleanup after 30 minutes (QR expiry time)
    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      pollIntervalRef.current = null
      setPaymentState('failed')
      setError('QR code expired. Please try again.')
    }, 1800000) // 30 minutes

    timeoutRef.current = timeout
  }, [checkPaymentStatus])

  const handlePayment = useCallback(async () => {
    // Prevent multiple payment creations
    if (isCreatingPayment.current) {
      console.log('Payment creation already in progress, skipping...')
      return
    }

    try {
      isCreatingPayment.current = true
      setPaymentState('creating')
      setError(null)

      // Call your API to create payment
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedServiceData.price,
          description: `Smart Shoe Care - ${selectedServiceData.name}`,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment')
      }

      // Save payment intent ID and QR image URL
      setPaymentIntentId(data.paymentIntentId)
      setQrImageUrl(data.qrImageUrl)
      setPaymentState('awaiting_payment')

      // Start polling for payment status
      startPolling(data.paymentIntentId)

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message)
      setPaymentState('failed')
      isCreatingPayment.current = false
    }
  }, [selectedServiceData, startPolling])

  // Auto-generate QR on page load - only once
  useEffect(() => {
    if (selectedService && paymentState === 'idle' && !isCreatingPayment.current) {
      handlePayment()
    }
  }, [selectedService, paymentState, handlePayment])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      isCreatingPayment.current = false
    }
  }, [])

  const handleCancel = async () => {
    // Stop polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    // Reset refs
    pollIntervalRef.current = null
    timeoutRef.current = null
    isCreatingPayment.current = false
    
    // Cancel the payment intent on PayMongo if it exists
    if (paymentIntentId) {
      try {
        console.log('Cancelling payment intent:', paymentIntentId)
        await fetch('/api/payment/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId })
        })
        console.log('Payment intent cancelled successfully')
      } catch (error) {
        console.error('Failed to cancel payment intent:', error)
        // Still navigate back even if cancellation fails
      }
    }
    
    // Navigate back to previous page
    router.back()
  }

  // TEST ONLY: Simulate successful payment
  const handleTestSuccess = async () => {
    console.log('🧪 TEST: Simulating payment success')
    // Stop polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    // Cancel the payment intent to void the QR code
    if (paymentIntentId) {
      try {
        console.log('🧪 TEST: Cancelling payment intent:', paymentIntentId)
        await fetch('/api/payment/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId })
        })
        console.log('🧪 TEST: Payment intent cancelled (QR code voided)')
      } catch (error) {
        console.error('Failed to cancel payment intent:', error)
        // Continue to redirect anyway
      }
    }
    
    // Redirect immediately to success page with service and care
    router.push(`/user/success/payment?service=${selectedService}&care=${selectedCare}`)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card className="bg-white/80 backdrop-blur-md shadow-2xl border border-white/50">
        <CardHeader className="border-white/30">
          <CardTitle className="text-2xl flex items-center justify-center gap-2 text-gray-800">
            {paymentState === 'failed' ? (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                Payment Failed
              </>
            ) : (
              'Scan QR Code to Pay'
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="px-6">
          {/* Payment States */}
          {paymentState === 'creating' && (
            <div className="text-center py-8">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/40">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-lg font-medium text-gray-800">Generating QR code...</p>
              </div>
            </div>
          )}

          {paymentState === 'awaiting_payment' && qrImageUrl && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left Side - Service Details & Instructions */}
              <div className="space-y-6">
                {/* Service Details */}
                <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-white/40 shadow-sm">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{selectedServiceData.name}</h3>
                      <p className="text-sm text-gray-600">{selectedServiceData.description}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-3xl font-bold text-blue-600">₱{selectedServiceData.price}</p>
                      <p className="text-xs text-gray-600 mt-1">Total Amount</p>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-white/40 shadow-sm">
                  <h4 className="font-semibold text-base text-gray-800 mb-3">Payment Instructions</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">1.</span>
                      <p>Open your GCash, PayMaya, or any QRPH supported app</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">2.</span>
                      <p>Scan the QR code on the right side</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">3.</span>
                      <p>Confirm the payment amount</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">4.</span>
                      <p>Complete the transaction</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-white/40 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600 font-medium">
                      Waiting for payment confirmation...
                    </p>
                  </div>
                  <p className="text-xs text-yellow-600 font-medium text-center">
                    ⏱️ QR code expires in 30 minutes
                  </p>
                </div>

                {/* Cancel Button */}
                <Button
                  onClick={handleCancel}
                  variant="default"
                  className="w-full hover:bg-red-400 text-white-800 bg-red-500 backdrop-blur-sm border shadow-md flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2 text-white-800" />
                  Cancel Payment
                </Button>

                {/* TEST BUTTON - Only visible when enabled */}
                {process.env.NEXT_PUBLIC_ENABLE_PAYMENT_TEST === 'true' && (
                  <Button
                    onClick={handleTestSuccess}
                    variant="default"
                    className="w-full bg-yellow-400 hover:bg-yellow-200 text-yellow-800 border-yellow-300 flex items-center justify-center gap-2"
                  >
                    <TestTube className="w-4 h-4" />
                    Test Success
                  </Button>
                )}
              </div>

              {/* Right Side - QR Code */}
              <div className="flex items-center justify-center">
                <div className="border border-white/40 rounded-xl p-8 bg-white/70 backdrop-blur-sm shadow-md h-full flex flex-col justify-center items-center">
                  <img 
                    src={qrImageUrl} 
                    alt="QRPH Payment QR Code" 
                    className="max-w-full h-auto"
                    style={{ maxWidth: '400px' }}
                  />
                  <p className="text-center text-sm text-gray-600 mt-4 font-medium">
                    Secure and verified by QRPH with PayMongo API
                  </p>
                </div>
              </div>
            </div>
          )}

          {paymentState === 'checking' && (
            <div className="text-center py-8">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/40">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-lg font-medium text-gray-800">Verifying payment...</p>
              </div>
            </div>
          )}

          {paymentState === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-red-200/50">
                <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <p className="text-lg font-medium text-red-600">{error || 'Payment failed'}</p>
              </div>
              <Button
                onClick={async () => {
                  // Cancel old payment intent first
                  if (paymentIntentId) {
                    try {
                      await fetch('/api/payment/cancel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentIntentId })
                      })
                    } catch (err) {
                      console.error('Failed to cancel old payment:', err)
                    }
                  }
                  
                  // Reset state and create new payment
                  setPaymentIntentId(null)
                  setQrImageUrl(null)
                  setPaymentState('idle')
                  setError(null)
                  isCreatingPayment.current = false
                  handlePayment()
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Generate New QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OnlinePayment