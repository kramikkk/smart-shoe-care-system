'use client'

import { Smartphone, Wifi, WifiOff, Check, X, Pencil, Loader2, RotateCcw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

type DevicePairingCardProps = {
  devices: DeviceWithStatus[]
  isPairing: boolean
  pairingDialogOpen: boolean
  pairingDeviceId: string
  pairingCode: string
  editingDeviceId: string | null
  editingDeviceName: string
  restartingDeviceId: string | null
  unpairConfirmId: string | null
  onPairingDialogOpenChange: (open: boolean) => void
  onPairingDeviceIdChange: (value: string) => void
  onPairingCodeChange: (value: string) => void
  onPairDevice: () => void
  onUnpairDevice: (deviceId: string) => void
  onRestartDevice: (deviceId: string) => void
  onEditingDeviceIdChange: (id: string | null) => void
  onEditingDeviceNameChange: (name: string) => void
  onSaveDeviceName: (deviceId: string, name: string) => Promise<void>
  onUnpairConfirmIdChange: (id: string | null) => void
  formatLastSeen: (dateString: string) => string
}

export function DevicePairingCard({
  devices,
  isPairing,
  pairingDialogOpen,
  pairingDeviceId,
  pairingCode,
  editingDeviceId,
  editingDeviceName,
  restartingDeviceId,
  unpairConfirmId,
  onPairingDialogOpenChange,
  onPairingDeviceIdChange,
  onPairingCodeChange,
  onPairDevice,
  onUnpairDevice,
  onRestartDevice,
  onEditingDeviceIdChange,
  onEditingDeviceNameChange,
  onSaveDeviceName,
  onUnpairConfirmIdChange,
  formatLastSeen,
}: DevicePairingCardProps) {
  return (
    <>
      {/* Unpair Confirm Dialog */}
      <Dialog open={!!unpairConfirmId} onOpenChange={(open) => { if (!open) onUnpairConfirmIdChange(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpair Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to unpair this device? The machine will need to be re-paired to reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onUnpairConfirmIdChange(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (unpairConfirmId) onUnpairDevice(unpairConfirmId)
                onUnpairConfirmIdChange(null)
              }}
            >
              Unpair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Device Pairing</CardTitle>
              </div>
              <CardDescription>
                Manage connected shoe care machines. Pair devices using device ID and pairing code from kiosk.
              </CardDescription>
            </div>
            <Dialog open={pairingDialogOpen} onOpenChange={onPairingDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto sm:shrink-0">
                  <Smartphone className="h-4 w-4" />
                  Pair New Device
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pair New Device</DialogTitle>
                  <DialogDescription>
                    Enter the device ID and 6-digit pairing code displayed on the kiosk screen.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceId">Device ID</Label>
                    <Input
                      id="deviceId"
                      placeholder="e.g., SSCM-XXXXXX"
                      value={pairingDeviceId}
                      onChange={(e) => onPairingDeviceIdChange(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pairingCode">Pairing Code</Label>
                    <Input
                      id="pairingCode"
                      placeholder="6-digit code"
                      maxLength={6}
                      value={pairingCode}
                      onChange={(e) => onPairingCodeChange(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onPairingDialogOpenChange(false)
                      onPairingDeviceIdChange('')
                      onPairingCodeChange('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onPairDevice}
                    disabled={isPairing || !pairingDeviceId || pairingCode.length !== 6}
                  >
                    {isPairing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Pairing...
                      </>
                    ) : (
                      'Pair Device'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                            {editingDeviceId === device.deviceId ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingDeviceName}
                                  onChange={(e) => onEditingDeviceNameChange(e.target.value)}
                                  className="h-8 w-48"
                                  autoFocus
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      await onSaveDeviceName(device.deviceId, editingDeviceName)
                                    } else if (e.key === 'Escape') {
                                      onEditingDeviceIdChange(null)
                                    }
                                  }}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => onSaveDeviceName(device.deviceId, editingDeviceName)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => onEditingDeviceIdChange(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">
                                  {device.name || 'Smart Shoe Care Machine'}
                                </h3>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    onEditingDeviceIdChange(device.deviceId)
                                    onEditingDeviceNameChange(device.name || 'Smart Shoe Care Machine')
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <Badge
                              variant="outline"
                              className={
                                device.status === 'connected'
                                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                  : device.status === 'pairing'
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                                  : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
                              }
                            >
                              {device.status === 'connected' && <Check className="h-3 w-3 mr-1" />}
                              {device.status === 'connected' ? 'Online' : device.status === 'disconnected' ? 'Offline' : 'Pairing'}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-1 break-all">
                            Device ID: <span className="font-mono">{device.deviceId}</span>
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <span>Camera ID: <span className="font-mono">{device.camDeviceId || 'Not paired'}</span></span>
                            <Badge
                              variant="outline"
                              className={
                                device.camSynced
                                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs h-5'
                                  : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800 text-xs h-5'
                              }
                            >
                              {device.camSynced ? 'Synced' : 'Not Synced'}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <div>
                              Last seen: <span className="text-foreground">{formatLastSeen(device.lastSeen)}</span>
                            </div>
                            {device.pairedAt && (
                              <div>
                                Paired: <span className="text-foreground">{new Date(device.pairedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {device.pairedByUser && (
                              <div>
                                Paired by: <span className="text-foreground">{device.pairedByUser.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {device.paired && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRestartDevice(device.deviceId)}
                            disabled={restartingDeviceId === device.deviceId}
                            className="text-amber-600 hover:text-amber-600 hover:bg-amber-500/10 sm:shrink-0 w-full sm:w-auto"
                          >
                            {restartingDeviceId === device.deviceId ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-1" />
                            )}
                            Restart
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onUnpairConfirmIdChange(device.deviceId)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:shrink-0 w-full sm:w-auto"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Unpair
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
