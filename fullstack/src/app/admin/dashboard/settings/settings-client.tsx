'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Settings, Sparkles, Wind, ShieldCheck, Package, Save, Loader2, Smartphone, Wifi, WifiOff, Check, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

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

type Device = {
  id: string
  deviceId: string
  deviceName: string
  status: 'connected' | 'disconnected' | 'pairing'
  lastSeen: string
  pairedAt?: string
}

// Mock device data - will be replaced with real API calls
const mockDevices: Device[] = [
  {
    id: '1',
    deviceId: 'SSCM-001',
    deviceName: 'Shoe Care Machine #1',
    status: 'connected',
    lastSeen: new Date().toISOString(),
    pairedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    deviceId: 'SSCM-002',
    deviceName: 'Shoe Care Machine #2',
    status: 'disconnected',
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    pairedAt: '2024-01-10T14:20:00Z',
  },
]

export default function SettingsClient() {
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({})
  const [devices, setDevices] = useState<Device[]>(mockDevices)
  const [isPairing, setIsPairing] = useState(false)

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

  const handlePairDevice = async () => {
    setIsPairing(true)
    // TODO: Implement actual device pairing logic
    setTimeout(() => {
      toast.success('Scanning for devices...')
      setIsPairing(false)
    }, 2000)
  }

  const handleUnpairDevice = async (deviceId: string) => {
    // TODO: Implement actual device unpairing logic
    toast.success('Device unpaired successfully')
  }

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
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
            {pricing.map((item) => {
              const iconColor = serviceIcons[item.serviceType as keyof typeof serviceIcons].color
              return (
              <div
                key={item.id}
                className="border rounded-lg p-4 space-y-4 transition-colors"
                style={{
                  ['--hover-border-color' as any]: iconColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = iconColor
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = ''
                }}
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
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Device Pairing Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div>
              <CardTitle className="text-lg">Device Pairing</CardTitle>
              <CardDescription>
                Manage connected shoe care machines. Pair new devices or unpair existing ones.
              </CardDescription>
            </div>
            <Button
              onClick={handlePairDevice}
              disabled={isPairing}
              className="gap-2 w-full sm:w-auto sm:shrink-0"
            >
              {isPairing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" />
                  Pair New Device
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {devices.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No devices paired yet</p>
                <p className="text-sm text-muted-foreground">Click "Pair New Device" to get started</p>
              </div>
            ) : (
              devices.map((device) => {
                const statusColor = device.status === 'connected' ? '#22c55e' : device.status === 'pairing' ? '#f59e0b' : '#6b7280'
                return (
                <div
                  key={device.id}
                  className="border rounded-lg p-4 transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = statusColor
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = ''
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div
                        className={`p-3 rounded-lg shrink-0 ${
                          device.status === 'connected'
                            ? 'bg-green-500/10 text-green-500'
                            : device.status === 'pairing'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-gray-500/10 text-gray-500'
                        }`}
                      >
                        {device.status === 'connected' ? (
                          <Wifi className="h-6 w-6" />
                        ) : (
                          <WifiOff className="h-6 w-6" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h3 className="font-semibold truncate">{device.deviceName}</h3>
                          <Badge
                            variant={device.status === 'connected' ? 'default' : 'secondary'}
                            className={
                              device.status === 'connected'
                                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                : device.status === 'pairing'
                                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
                            }
                          >
                            {device.status === 'connected' && <Check className="h-3 w-3 mr-1" />}
                            {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 break-all">
                          Device ID: <span className="font-mono">{device.deviceId}</span>
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <div>
                            Last seen: <span className="text-foreground">{formatLastSeen(device.lastSeen)}</span>
                          </div>
                          {device.pairedAt && (
                            <div>
                              Paired: <span className="text-foreground">{new Date(device.pairedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnpairDevice(device.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:shrink-0 w-full sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Unpair
                    </Button>
                  </div>
                </div>
                );
              })
            )}
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
