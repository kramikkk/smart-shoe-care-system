'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PaymentReturn() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get payment intent ID from URL
    const paymentIntentId = searchParams.get('payment_intent_id')
    
    if (paymentIntentId) {
      // If opened in popup/iframe, close it and notify parent
      if (window.opener) {
        window.opener.postMessage(
          { 
            type: 'PAYMENT_RETURN',
            paymentIntentId 
          },
          window.location.origin
        )
        window.close()
      } else {
        // If not in popup, redirect to main page
        router.push(`/user/payment/online?paymentIntentId=${paymentIntentId}`)
      }
    }
  }, [searchParams, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
        <p className="text-lg">Processing payment...</p>
      </div>
    </div>
  )
}