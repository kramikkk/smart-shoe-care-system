import { LogOut, Moon, User } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeToggle } from "@/components/ModeToggle"
import { SidebarTrigger } from "./ui/sidebar"

const NavBar = () => {
  return (
    <nav className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Link href="/admin/dashboard" className="text-base font-bold"> Admin Dashboard </Link>
      </div>
      <div className="flex items-center gap-4">
        <ModeToggle/>
      </div>
    </nav>
  )
}

export default NavBar 