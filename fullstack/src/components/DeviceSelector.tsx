'use client'

import { useDeviceFilter } from '@/contexts/DeviceFilterContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Smartphone } from 'lucide-react'

export function DeviceSelector() {
  const { selectedDevice, setSelectedDevice, devices, isLoading } = useDeviceFilter()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        Loading devices...
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        No devices
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Smartphone className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedDevice} onValueChange={setSelectedDevice}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Select device" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.deviceId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
