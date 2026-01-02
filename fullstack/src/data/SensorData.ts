import { 
  Thermometer, 
  Droplets, 
  Zap, 
  Gauge
} from "lucide-react"

export const SensorData = {
  temperature: {
    name: "Temperature",
    value: "0°C",
    percentage: 0,
    icon: Thermometer,
    color: "text-orange-600",
    range: "18-30°C",
    status: "Normal"
  },
  foamLevel: {
    name: "Foam Level",
    value: "0%",
    percentage: 0,
    icon: Droplets,
    color: "text-blue-600",
    range: "0-100%",
    status: "Normal"
  },
  atomizerLevel: {
    name: "Atomizer Level",
    value: "0%",
    percentage: 0,
    icon: Gauge,
    color: "text-cyan-600",
    range: "0-100%",
    status: "Normal"
  },
  humidity: {
    name: "Humidity",
    value: "0%",
    percentage: 0,
    icon: Droplets,
    color: "text-teal-600",
    range: "40-70%",
    status: "Normal"
  },
    systemStatus: {
    name: "System Status",
    value: "Idle",
    percentage: 0,
    icon: Zap,
    color: "text-yellow-600",
    range: "Timer: 00:00",
    status: "Idle"
  },
} as const