import { ShoppingCart, DollarSign, LucideIcon, Coins } from "lucide-react"

export const StatsData: Record<string, {
  title: string
  value: string
  trendValue: number
  isPositive: boolean
  footerDescription: string
  icon: LucideIcon
  iconColor: string
}> = {
  totalTransactions: {
    title: "Total Transactions",
    value: "10",
    trendValue: 12.5,
    isPositive: true,
    footerDescription: "+2 from yesterday",
    icon: ShoppingCart,
    iconColor: "text-blue-500",
  },
  totalRevenue: {
    title: "Total Revenue",
    value: "₱1,250.00",
    trendValue: 20,
    isPositive: false,
    footerDescription: "+ ₱124 from yesterday",
    icon: Coins,
    iconColor: "text-yellow-500",
  },
}
