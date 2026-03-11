'use client'

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useDeviceFilter } from "@/contexts/DeviceFilterContext"
import { DevicePairingCard } from "@/components/settings/DevicePairingCard"
import { ServicePricingCard } from "@/components/settings/ServicePricingCard"
import { ServiceDurationCard } from "@/components/settings/ServiceDurationCard"

type ServicePricing = {
  id: string
  serviceType: string
  price: number
  createdAt: string
  updatedAt: string
}

type ServiceDuration = {
  serviceType: string
  careType: string
  duration: number // seconds
}

type DurationMap = Record<string, Record<string, number>> // serviceType -> careType -> seconds

type Device = {
  id: string
  deviceId: string
  name: string | null
  pairingCode: string | null
  paired: boolean
  pairedAt: string | null
  pairedBy: string | null
  lastSeen: string
  createdAt: string
  camSynced: boolean
  camDeviceId: string | null
  pairedByUser?: {
    name: string
    email: string
  }
}

type DeviceWithStatus = Device & {
  status: 'connected' | 'disconnected' | 'pairing'
}

export default function SettingsPage() {
  const { selectedDevice } = useDeviceFilter()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({})
  const [devices, setDevices] = useState<DeviceWithStatus[]>([])
  const [isPairing, setIsPairing] = useState(false)
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false)
  const [pairingDeviceId, setPairingDeviceId] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [editingDeviceName, setEditingDeviceName] = useState('')
  const [restartingDeviceId, setRestartingDeviceId] = useState<string | null>(null)
  const [unpairConfirmId, setUnpairConfirmId] = useState<string | null>(null)
  const autoOpenedRef = useRef(false)
  const [durations, setDurations] = useState<DurationMap>({})
  const [editedDurations, setEditedDurations] = useState<DurationMap>({})
  const [isSavingDuration, setIsSavingDuration] = useState(false)

  // Auto-open pairing dialog when redirected from QR code scan
  useEffect(() => {
    if (autoOpenedRef.current) return
    const pair = searchParams.get('pair')
    const code = searchParams.get('code')
    if (pair && code) {
      autoOpenedRef.current = true
      setPairingDeviceId(pair)
      setPairingCode(code)
      setPairingDialogOpen(true)
    }
  }, [searchParams])

  // Fetch pricing and durations for selected device
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDevice) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const [pricingRes, durationRes] = await Promise.all([
          fetch(`/api/pricing?deviceId=${selectedDevice}`),
          fetch(`/api/duration?deviceId=${selectedDevice}`),
        ])
        const [pricingData, durationData] = await Promise.all([
          pricingRes.json(),
          durationRes.json(),
        ])

        if (pricingData.success) {
          setPricing(pricingData.pricing)
          const initialPrices: Record<string, number> = {}
          pricingData.pricing.forEach((item: ServicePricing) => {
            initialPrices[item.serviceType] = item.price
          })
          setEditedPrices(initialPrices)
        } else {
          toast.error(pricingData.error || "Failed to fetch pricing")
        }

        if (durationData.success) {
          const map: DurationMap = {}
          durationData.durations.forEach((item: ServiceDuration) => {
            if (!map[item.serviceType]) map[item.serviceType] = {}
            map[item.serviceType][item.careType] = item.duration
          })
          setDurations(map)
          setEditedDurations(JSON.parse(JSON.stringify(map)))
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        toast.error("Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedDevice])

  // Fetch only paired devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/device/list')
        const data = await response.json()

        if (data.success) {
          // Only show paired devices in the list
          const pairedDevices = data.devices.filter((device: Device) => device.paired)
          const devicesWithStatus: DeviceWithStatus[] = pairedDevices.map((device: Device) => {
            const lastSeenDate = new Date(device.lastSeen)
            const now = new Date()
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 60000

            let status: 'connected' | 'disconnected' | 'pairing'
            if (diffMinutes < 5) {
              status = 'connected'
            } else {
              status = 'disconnected'
            }

            return { ...device, status }
          })
          setDevices(devicesWithStatus)
        }
      } catch (error) {
        console.error('Error fetching devices:', error)
      }
    }

    fetchDevices()
    // Poll every 10 seconds to update device statuses
    const interval = setInterval(fetchDevices, 10000)
    return () => clearInterval(interval)
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
          deviceId: selectedDevice,
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

        const serviceNamesMap: Record<string, string> = {
          cleaning: 'Cleaning',
          drying: 'Drying',
          sterilizing: 'Sterilizing',
          package: 'Package',
        }
        toast.success(`${serviceNamesMap[serviceType] ?? serviceType} price updated successfully`)
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
    if (!pairingDeviceId || !pairingCode) {
      toast.error('Please enter both device ID and pairing code')
      return
    }

    if (pairingCode.length !== 6) {
      toast.error('Pairing code must be 6 digits')
      return
    }

    setIsPairing(true)
    try {
      const response = await fetch(`/api/device/${pairingDeviceId}/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairingCode: pairingCode,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Device paired successfully!')
        setPairingDialogOpen(false)
        setPairingDeviceId('')
        setPairingCode('')
        router.replace('/client/dashboard/settings')

        // Refresh devices list
        const devicesResponse = await fetch('/api/device/list')
        const devicesData = await devicesResponse.json()
        if (devicesData.success) {
          const pairedDevices = devicesData.devices.filter((device: Device) => device.paired)
          const devicesWithStatus: DeviceWithStatus[] = pairedDevices.map((device: Device) => {
            const lastSeenDate = new Date(device.lastSeen)
            const now = new Date()
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 60000

            let status: 'connected' | 'disconnected' | 'pairing'
            if (diffMinutes < 5) {
              status = 'connected'
            } else {
              status = 'disconnected'
            }

            return { ...device, status }
          })
          setDevices(devicesWithStatus)
        }
      } else {
        toast.error(data.error || 'Failed to pair device')
      }
    } catch (error) {
      console.error('Error pairing device:', error)
      toast.error('Failed to pair device')
    } finally {
      setIsPairing(false)
    }
  }

  const handleUnpairDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/device/${deviceId}/pair`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Device unpaired successfully')
        // Refresh devices list
        const devicesResponse = await fetch('/api/device/list')
        const devicesData = await devicesResponse.json()
        if (devicesData.success) {
          const pairedDevices = devicesData.devices.filter((device: Device) => device.paired)
          const devicesWithStatus: DeviceWithStatus[] = pairedDevices.map((device: Device) => {
            const lastSeenDate = new Date(device.lastSeen)
            const now = new Date()
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 60000

            let status: 'connected' | 'disconnected' | 'pairing'
            if (diffMinutes < 5) {
              status = 'connected'
            } else {
              status = 'disconnected'
            }

            return { ...device, status }
          })
          setDevices(devicesWithStatus)
        }
      } else {
        toast.error(data.error || 'Failed to unpair device')
      }
    } catch (error) {
      console.error('Error unpairing device:', error)
      toast.error('Failed to unpair device')
    }
  }

  const handleRestartDevice = async (deviceId: string) => {
    setRestartingDeviceId(deviceId)
    try {
      // Create a temporary WebSocket connection to send the restart command
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws?deviceId=admin-${Date.now()}`

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        // Send restart command
        ws.send(JSON.stringify({
          type: 'restart-device',
          deviceId: deviceId
        }))

        // Close connection after sending
        setTimeout(() => {
          ws.close()
          toast.success('Restart command sent to device')
          setRestartingDeviceId(null)
        }, 500)
      }

      ws.onerror = () => {
        toast.error('Failed to send restart command')
        setRestartingDeviceId(null)
      }

      // Timeout fallback
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close()
        }
        setRestartingDeviceId(null)
      }, 5000)
    } catch (error) {
      console.error('Error restarting device:', error)
      toast.error('Failed to restart device')
      setRestartingDeviceId(null)
    }
  }

  const handleDurationChange = (serviceType: string, careType: string, value: string) => {
    const num = parseInt(value)
    setEditedDurations(prev => ({
      ...prev,
      [serviceType]: { ...prev[serviceType], [careType]: isNaN(num) || num < 0 ? 0 : num },
    }))
  }

  const hasDurationChanges = (serviceType: string, careType: string) => {
    return durations[serviceType]?.[careType] !== editedDurations[serviceType]?.[careType]
  }

  const handleSaveDuration = async (serviceType: string, careType: string) => {
    const duration = editedDurations[serviceType]?.[careType]
    if (!duration || duration <= 0) {
      toast.error('Duration must be greater than 0')
      return
    }
    setIsSavingDuration(true)
    try {
      const res = await fetch('/api/duration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, careType, duration, deviceId: selectedDevice }),
      })
      const data = await res.json()
      if (data.success) {
        setDurations(prev => ({
          ...prev,
          [serviceType]: { ...prev[serviceType], [careType]: duration },
        }))
        toast.success(`${serviceType} (${careType}) duration updated`)
      } else {
        toast.error(data.error || 'Failed to update duration')
      }
    } catch {
      toast.error('Failed to save duration')
    } finally {
      setIsSavingDuration(false)
    }
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
              <CardTitle>Client Settings</CardTitle>
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
      <DevicePairingCard
        devices={devices}
        isPairing={isPairing}
        pairingDialogOpen={pairingDialogOpen}
        pairingDeviceId={pairingDeviceId}
        pairingCode={pairingCode}
        editingDeviceId={editingDeviceId}
        editingDeviceName={editingDeviceName}
        restartingDeviceId={restartingDeviceId}
        unpairConfirmId={unpairConfirmId}
        onPairingDialogOpenChange={setPairingDialogOpen}
        onPairingDeviceIdChange={setPairingDeviceId}
        onPairingCodeChange={setPairingCode}
        onPairDevice={handlePairDevice}
        onUnpairDevice={handleUnpairDevice}
        onRestartDevice={handleRestartDevice}
        onEditingDeviceIdChange={setEditingDeviceId}
        onEditingDeviceNameChange={setEditingDeviceName}
        onSaveDeviceName={async (deviceId, name) => {
          try {
            const res = await fetch(`/api/device/${deviceId}/name`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })
            const data = await res.json()
            if (data.success) {
              setDevices(prev => prev.map(d => d.deviceId === deviceId ? { ...d, name } : d))
              setEditingDeviceId(null)
              toast.success('Device name updated')
            } else {
              toast.error(data.error || 'Failed to update name')
            }
          } catch {
            toast.error('Failed to update name')
          }
        }}
        onUnpairConfirmIdChange={setUnpairConfirmId}
        formatLastSeen={formatLastSeen}
      />

      <ServicePricingCard
        pricing={pricing}
        editedPrices={editedPrices}
        isSaving={isSaving}
        selectedDevice={selectedDevice}
        onPriceChange={handlePriceChange}
        onSave={handleSave}
        hasChanges={hasChanges}
      />

      <ServiceDurationCard
        durations={durations}
        editedDurations={editedDurations}
        isSavingDuration={isSavingDuration}
        selectedDevice={selectedDevice}
        onDurationChange={handleDurationChange}
        hasDurationChanges={hasDurationChanges}
        onSaveDuration={handleSaveDuration}
      />
    </div>
  )
}
