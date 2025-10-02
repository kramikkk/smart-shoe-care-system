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
      <div>
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-4">
        <Link href="/admin"> Dashboard </Link>
        <ModeToggle/>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem> <User/> Profile</DropdownMenuItem>
            <DropdownMenuItem variant="destructive"> <LogOut/> Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}

export default NavBar 