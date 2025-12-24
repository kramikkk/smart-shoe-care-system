'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Settings, Sparkles, Wind, ShieldCheck, Package, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

type ServicePricing = {
  id: string
  serviceType: string
  price: number
  createdAt: string
  updatedAt: string
}

const serviceIcons = {
  cleaning: { icon: <Sparkles className="h-5 w-5" />, color: 'var(--chart-1)' },
  drying: { icon: <Wind className="h-5 w-5" />, color: 'var(--chart-2)' },
  sterilizing: { icon: <ShieldCheck className="h-5 w-5" />, color: 'var(--chart-3)' },
  package: { icon: <Package className="h-5 w-5" />, color: 'var(--chart-4)' },
}

const serviceNames = {
  cleaning: 'Cleaning',
  drying: 'Drying',
  sterilizing: 'Sterilizing',
  package: 'Package',
}

export default function SettingsClient() {
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({})

  // Fetch pricing data
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await fetch('/api/pricing')
        const data = await response.json()

        if (data.success) {
          setPricing(data.pricing)
          // Initialize edited prices with current prices
          const initialPrices: Record<string, number> = {}
          data.pricing.forEach((item: ServicePricing) => {
            initialPrices[item.serviceType] = item.price
          })
          setEditedPrices(initialPrices)
        } else {
          toast.error(data.error || "Failed to fetch pricing")
        }
      } catch (error) {
        console.error('Error fetching pricing:', error)
        toast.error("Failed to load pricing data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPricing()
  }, [])

  const handlePriceChange = (serviceType: string, value: string) => {
    // Allow empty string for user to clear input
    if (value === '') {
      setEditedPrices(prev => ({
        ...prev,
        [serviceType]: '' as any,
      }))
      return
    }

    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedPrices(prev => ({
        ...prev,
        [serviceType]: numValue,
      }))
    }
  }

  const handleSave = async (serviceType: string) => {
    // Don't save if value is empty or invalid
    const price = editedPrices[serviceType]
    if (price === '' || price === undefined || price === null) {
      toast.error('Please enter a valid price')
      return
    }

    const numPrice = Number(price)
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Please enter a valid positive number')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          price: numPrice,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update the pricing state
        setPricing(prev =>
          prev.map(item =>
            item.serviceType === serviceType
              ? { ...item, price: numPrice }
              : item
          )
        )

        toast.success(`${serviceNames[serviceType as keyof typeof serviceNames]} price updated successfully`)
      } else {
        toast.error(data.error || "Failed to update pricing")
      }
    } catch (error) {
      console.error('Error updating pricing:', error)
      toast.error("Failed to save pricing")
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = (serviceType: string) => {
    const currentPrice = pricing.find(p => p.serviceType === serviceType)?.price
    return currentPrice !== editedPrices[serviceType]
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-500" />
              <CardTitle>Admin Settings</CardTitle>
            </div>
            <CardDescription>Loading settings...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Service Pricing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Pricing</CardTitle>
          <CardDescription>
            Update the price for each service type. Changes will be reflected immediately on the user payment page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pricing.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 space-y-4 hover:border-purple-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${serviceIcons[item.serviceType as keyof typeof serviceIcons].color} 15%, transparent)`,
                      color: serviceIcons[item.serviceType as keyof typeof serviceIcons].color
                    }}
                  >
                    {serviceIcons[item.serviceType as keyof typeof serviceIcons].icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {serviceNames[item.serviceType as keyof typeof serviceNames]}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Current: ₱{item.price.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`price-${item.serviceType}`}>Price (PHP)</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        ₱
                      </span>
                      <Input
                        id={`price-${item.serviceType}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={editedPrices[item.serviceType] ?? ''}
                        onChange={(e) => handlePriceChange(item.serviceType, e.target.value)}
                        className="pl-7"
                        disabled={isSaving}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(item.serviceType)}
                      disabled={!hasChanges(item.serviceType) || isSaving}
                      size="icon"
                      className="shrink-0"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {hasChanges(item.serviceType) && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Unsaved changes
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Settings Sections (Future) */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">Additional Settings</CardTitle>
          <CardDescription>
            More configuration options coming soon...
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
