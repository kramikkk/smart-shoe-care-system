import { useState, useEffect } from "react"
import { toast } from "sonner"

type ServicePricing = {
  id: string
  serviceType: string
  price: number
  createdAt: string
  updatedAt: string
}

export function useServicePricing(selectedDevice: string | null) {
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!selectedDevice) { setIsLoading(false); return }
    setIsLoading(true)
    fetch(`/api/pricing?deviceId=${selectedDevice}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setPricing(data.pricing)
          const initial: Record<string, number> = {}
          data.pricing.forEach((item: ServicePricing) => { initial[item.serviceType] = item.price })
          setEditedPrices(initial)
        } else {
          toast.error(data.error || "Failed to fetch pricing")
        }
      })
      .catch(() => toast.error("Failed to load pricing"))
      .finally(() => setIsLoading(false))
  }, [selectedDevice])

  const handlePriceChange = (serviceType: string, value: string) => {
    if (value === '') { setEditedPrices(prev => ({ ...prev, [serviceType]: '' })); return }
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) setEditedPrices(prev => ({ ...prev, [serviceType]: num }))
  }

  const hasChanges = (serviceType: string) =>
    pricing.find(p => p.serviceType === serviceType)?.price !== editedPrices[serviceType]

  const handleSave = async (serviceType: string) => {
    const price = editedPrices[serviceType]
    if (price === '' || price === undefined) { toast.error('Please enter a valid price'); return }
    const numPrice = Number(price)
    if (isNaN(numPrice) || numPrice < 0) { toast.error('Please enter a valid positive number'); return }
    setIsSaving(true)
    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, price: numPrice, deviceId: selectedDevice }),
      })
      const data = await res.json()
      if (data.success) {
        setPricing(prev => prev.map(item => item.serviceType === serviceType ? { ...item, price: numPrice } : item))
        const names: Record<string, string> = { cleaning: 'Cleaning', drying: 'Drying', sterilizing: 'Sterilizing', package: 'Package' }
        toast.success(`${names[serviceType] ?? serviceType} price updated`)
      } else {
        toast.error(data.error || "Failed to update pricing")
      }
    } catch { toast.error("Failed to save pricing") }
    finally { setIsSaving(false) }
  }

  return { pricing, editedPrices, isLoading, isSaving, handlePriceChange, hasChanges, handleSave }
}
