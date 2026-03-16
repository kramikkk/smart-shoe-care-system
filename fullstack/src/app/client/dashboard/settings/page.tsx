'use client'

import { Loader2, Settings } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDeviceFilter } from "@/contexts/DeviceFilterContext"
import { DevicePairingCard } from "@/components/settings/DevicePairingCard"
import { ServicePricingCard } from "@/components/settings/ServicePricingCard"
import { ServiceDurationCard } from "@/components/settings/ServiceDurationCard"
import { useDevicePairing } from "@/hooks/useDevicePairing"
import { useServicePricing } from "@/hooks/useServicePricing"
import { useServiceDuration } from "@/hooks/useServiceDuration"

export default function SettingsPage() {
  const { selectedDevice } = useDeviceFilter()
  const pairing = useDevicePairing()
  const pricing = useServicePricing(selectedDevice)
  const duration = useServiceDuration(selectedDevice)

  if (pricing.isLoading || duration.isLoading) {
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
        devices={pairing.devices}
        isPairing={pairing.isPairing}
        pairingDialogOpen={pairing.pairingDialogOpen}
        pairingDeviceId={pairing.pairingDeviceId}
        pairingCode={pairing.pairingCode}
        editingDeviceId={pairing.editingDeviceId}
        editingDeviceName={pairing.editingDeviceName}
        restartingDeviceId={pairing.restartingDeviceId}
        unpairConfirmId={pairing.unpairConfirmId}
        onPairingDialogOpenChange={pairing.setPairingDialogOpen}
        onPairingDeviceIdChange={pairing.setPairingDeviceId}
        onPairingCodeChange={pairing.setPairingCode}
        onPairDevice={pairing.handlePairDevice}
        onUnpairDevice={pairing.handleUnpairDevice}
        onRestartDevice={pairing.handleRestartDevice}
        onEditingDeviceIdChange={pairing.setEditingDeviceId}
        onEditingDeviceNameChange={pairing.setEditingDeviceName}
        onSaveDeviceName={pairing.handleSaveDeviceName}
        onUnpairConfirmIdChange={pairing.setUnpairConfirmId}
        formatLastSeen={pairing.formatLastSeen}
      />
      <ServicePricingCard
        pricing={pricing.pricing}
        editedPrices={pricing.editedPrices}
        isSaving={pricing.isSaving}
        selectedDevice={selectedDevice}
        onPriceChange={pricing.handlePriceChange}
        onSave={pricing.handleSave}
        hasChanges={pricing.hasChanges}
      />
      <ServiceDurationCard
        durations={duration.durations}
        editedDurations={duration.editedDurations}
        isSavingDuration={duration.isSaving}
        selectedDevice={selectedDevice}
        onDurationChange={duration.handleDurationChange}
        hasDurationChanges={duration.hasDurationChanges}
        onSaveDuration={duration.handleSaveDuration}
      />
    </div>
  )
}
