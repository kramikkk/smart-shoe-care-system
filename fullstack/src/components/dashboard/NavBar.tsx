'use client'

import Link from "next/link"
import { ModeToggle } from "@/components/ModeToggle"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DeviceSelector } from "@/components/DeviceSelector"

const NavBar = () => {
  return (
    <nav className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Link href="/client/dashboard" className="text-base font-bold"> Client Dashboard</Link>
      </div>
      <div className="flex items-center gap-4">
        <DeviceSelector />
        <ModeToggle/>
      </div>
    </nav>
  )
}

export default NavBar 