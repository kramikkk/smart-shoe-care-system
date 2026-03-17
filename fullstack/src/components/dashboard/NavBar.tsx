"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { DeviceSelector } from "@/components/DeviceSelector"
import Image from "next/image"

const NavBar = () => {
  return (
    <nav className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tighter uppercase italic">
            SSCM <span className="text-primary">Portal</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <DeviceSelector />
      </div>
    </nav>
  )
}

export default NavBar
