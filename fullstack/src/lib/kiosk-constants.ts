// src/lib/kiosk-constants.ts

export const CUSTOM_STEPS = ['Mode', 'Shoe Type', 'Service', 'Care Type', 'Payment'] as const
export const AUTO_STEPS = ['Mode', 'Scan Shoes', 'Payment'] as const

export type ServiceType = 'cleaning' | 'drying' | 'sterilizing' | 'package'

export interface Service {
  id: ServiceType
  name: string
  price: number
}

export const DEFAULT_SERVICES: Service[] = [
  { id: 'cleaning',    name: 'Cleaning',    price: 45 },
  { id: 'drying',      name: 'Drying',      price: 45 },
  { id: 'sterilizing', name: 'Sterilizing', price: 25 },
  { id: 'package',     name: 'Package',     price: 100 },
]
