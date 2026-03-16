import { useState, useEffect } from "react"
import { toast } from "sonner"

type ServiceDuration = { serviceType: string; careType: string; duration: number }
type DurationMap = Record<string, Record<string, number>>

export function useServiceDuration(selectedDevice: string | null) {
  const [durations, setDurations] = useState<DurationMap>({})
  const [editedDurations, setEditedDurations] = useState<DurationMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!selectedDevice) { setIsLoading(false); return }
    setIsLoading(true)
    fetch(`/api/duration?deviceId=${selectedDevice}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: DurationMap = {}
          data.durations.forEach((item: ServiceDuration) => {
            if (!map[item.serviceType]) map[item.serviceType] = {}
            map[item.serviceType][item.careType] = item.duration
          })
          setDurations(map)
          setEditedDurations(JSON.parse(JSON.stringify(map)))
        }
      })
      .catch(() => toast.error("Failed to load durations"))
      .finally(() => setIsLoading(false))
  }, [selectedDevice])

  const handleDurationChange = (serviceType: string, careType: string, value: string) => {
    const num = parseInt(value)
    setEditedDurations(prev => ({
      ...prev,
      [serviceType]: { ...prev[serviceType], [careType]: isNaN(num) || num < 0 ? 0 : num },
    }))
  }

  const hasDurationChanges = (serviceType: string, careType: string) =>
    durations[serviceType]?.[careType] !== editedDurations[serviceType]?.[careType]

  const handleSaveDuration = async (serviceType: string, careType: string) => {
    const duration = editedDurations[serviceType]?.[careType]
    if (!duration || duration <= 0) { toast.error('Duration must be greater than 0'); return }
    setIsSaving(true)
    try {
      const res = await fetch('/api/duration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, careType, duration, deviceId: selectedDevice }),
      })
      const data = await res.json()
      if (data.success) {
        setDurations(prev => ({ ...prev, [serviceType]: { ...prev[serviceType], [careType]: duration } }))
        toast.success(`${serviceType} (${careType}) duration updated`)
      } else {
        toast.error(data.error || 'Failed to update duration')
      }
    } catch { toast.error('Failed to save duration') }
    finally { setIsSaving(false) }
  }

  return { durations, editedDurations, isLoading, isSaving, handleDurationChange, hasDurationChanges, handleSaveDuration }
}
