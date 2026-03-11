'use client'

import { ModeToggle } from "@/components/ModeToggle"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DeviceSelector } from "@/components/DeviceSelector"
import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  '/client/dashboard': 'Dashboard',
  '/client/dashboard/transactions': 'Transactions',
  '/client/dashboard/monitoring': 'Monitoring',
  '/client/dashboard/settings': 'Settings',
}

const NavBar = () => {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'Dashboard'

  return (
    <nav className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <span className="text-base font-bold">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <DeviceSelector />
        <ModeToggle/>
      </div>
    </nav>
  )
}

export default NavBar
