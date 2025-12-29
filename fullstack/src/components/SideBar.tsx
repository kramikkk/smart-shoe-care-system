"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftRight, Cpu, LayoutDashboard, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { SideBarUser } from "./SideBarUser";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/actions/auth-action";

const menu = [
  { title: "Overview", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Transactions", url: "/admin/dashboard/transactions", icon: ArrowLeftRight },
  { title: "System", url: "/admin/dashboard/system", icon: Cpu },
  { title: "Settings", url: "/admin/dashboard/settings", icon: Settings },
]

const SideBar = () => {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; avatar: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const session = await getSession();
      if (session?.user) {
        setUser({
          name: session.user.name || "User",
          email: session.user.email || "user@example.com",
          avatar: session.user.image || "/SSCMlogo.png"
        });
      } else {
        // Fallback to default user if no session
        setUser({
          name: "Admin",
          email: "admin@example.com",
          avatar: "/SSCMlogo.png"
        });
      }
    };
    fetchUser();
  }, []);

  const isActive = (url: string) => {
    if (url === "/admin/dashboard") {
      return pathname === url;
    }
    return pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader className="pt-4">
            <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href="/admin/dashboard">
                    <Image src="/SSCMLogoCircle.png" alt="Logo" width={30} height={20} priority style={{ width: 'auto', height: 'auto' }}/>
                    <span className=" text-base font-bold">Smart Shoe Care</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                <SidebarSeparator className="w-full mx-auto "/>
                <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                    <SidebarMenu>
                        {menu.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.url);
                        return (
                            <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={active}>
                                <Link href={item.url} className="flex items-center gap-2">
                                <Icon className="w-5 h-5" />
                                <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                        })}
                    </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                {user && <SideBarUser user={user} />}
            </SidebarFooter>
    </Sidebar>
  )
}
export default SideBar