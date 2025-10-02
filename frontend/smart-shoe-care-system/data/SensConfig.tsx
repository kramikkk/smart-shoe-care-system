import { 
  Thermometer, 
  Droplets, 
  Zap, 
  Gauge
} from "lucide-react"

export const sensorData = {
  temperature: {
    name: "Temperature",
    value: "32°C",
    percentage: 80,
    icon: Thermometer,
    color: "text-orange-600",
    range: "18-30°C",
    status: "Warning"
  },
  humidity: {
    name: "Humidity",
    value: "45%",
    percentage: 45,
    icon: Droplets,
    color: "text-blue-600",
    range: "40-70%",
    status: "Normal"
  },
  atomizerLevel: {
    name: "Atomizer Level",
    value: "15%",
    percentage: 15,
    icon: Gauge,
    color: "text-cyan-600",
    range: "0-100%",
    status: "Critical"
  },
  uvLamp: {
    name: "UV Lamp Status",
    value: "Active",
    percentage: 100,
    icon: Zap,
    color: "text-purple-600",
    range: "On/Off",
    status: "Active"
  }
} as const