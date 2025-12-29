'use client'

import Link from "next/link"
import { ModeToggle } from "@/components/ModeToggle"
import { SidebarTrigger } from "./ui/sidebar"
import { DeviceSelector } from "./DeviceSelector"

const NavBar = () => {
  return (
    <nav className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Link href="/admin/dashboard" className="text-base font-bold"> Admin Dashboard </Link>
      </div>
      <div className="flex items-center gap-4">
        <DeviceSelector />
        <ModeToggle/>
      </div>
    </nav>
  )
}

export default NavBar 