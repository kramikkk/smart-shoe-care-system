"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftRight, Cpu, LayoutDashboard, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { SideBarUser } from "@/components/dashboard/SideBarUser";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/actions/auth-action";

const menu = [
  { title: "Overview", url: "/client/dashboard", icon: LayoutDashboard },
  { title: "Transactions", url: "/client/dashboard/transactions", icon: ArrowLeftRight },
  { title: "Monitoring", url: "/client/dashboard/monitoring", icon: Cpu },
  { title: "Settings", url: "/client/dashboard/settings", icon: Settings },
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
    if (url === "/client/dashboard") {
      return pathname === url;
    }
    return pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader className="pt-4">
            <Link href="/client/dashboard" className="flex flex-col items-center gap-1 py-2 hover:opacity-80 transition-opacity">
                <Image src="/SSCMlogoTrans.png" alt="Logo" width={256} height={256} priority className="w-full h-auto"/>
                <span className="text-base font-bold text-center leading-snug px-2">Smart Shoe Care Machine</span>
                <span className="text-xs text-muted-foreground">Client Portal</span>
            </Link>
        </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
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