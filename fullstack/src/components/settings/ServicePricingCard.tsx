'use client'

import { Sparkles, Wind, ShieldCheck, Package, Save, Loader2, Tag } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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

// System default prices (seeded values)
const FIRMWARE_PRICE_DEFAULTS: Record<string, number> = {
  cleaning:    45,
  drying:      25,
  sterilizing: 25,
  package:     100,
}

type ServicePricingCardProps = {
  pricing: ServicePricing[]
  editedPrices: Record<string, number | string>
  isSaving: boolean
  selectedDevice: string | null
  onPriceChange: (serviceType: string, value: string) => void
  onSave: (serviceType: string) => void
  hasChanges: (serviceType: string) => boolean
}

export function ServicePricingCard({
  pricing,
  editedPrices,
  isSaving,
  selectedDevice,
  onPriceChange,
  onSave,
  hasChanges,
}: ServicePricingCardProps) {
  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Service Pricing</CardTitle>
        </div>
        <CardDescription>
          Update prices for {selectedDevice}. These prices will only apply to this specific machine.
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
                      Default: ₱{(FIRMWARE_PRICE_DEFAULTS[item.serviceType] ?? 0).toFixed(2)}
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
                        onChange={(e) => onPriceChange(item.serviceType, e.target.value)}
                        className="pl-7"
                        disabled={isSaving}
                      />
                    </div>
                    <Button
                      onClick={() => onSave(item.serviceType)}
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
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
