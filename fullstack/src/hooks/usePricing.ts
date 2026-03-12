'use client'

import { useState, useEffect } from 'react'
import { Service, DEFAULT_SERVICES } from '@/lib/kiosk-constants'

export function usePricing() {
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const deviceId = localStorage.getItem('kiosk_device_id')
        const deviceParam = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
        const response = await fetch(`/api/pricing${deviceParam}`)
        const data = await response.json()
        if (data.success && Array.isArray(data.pricing)) {
          const fetched: Service[] = data.pricing.map((item: any) => ({
            id: item.serviceType,
            name: item.serviceType.charAt(0).toUpperCase() + item.serviceType.slice(1),
            price: item.price,
          }))
          setServices(fetched)
        }
      } catch {
        // fall back to defaults silently
      } finally {
        setIsLoaded(true)
      }
    }
    fetchPricing()
  }, [])

  return { services, isLoaded }
}
