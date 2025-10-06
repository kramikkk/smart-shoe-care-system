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
import { ArrowLeftRight, ChartLine, Cpu, LayoutDashboard,  } from "lucide-react";
import { usePathname } from "next/navigation";
import { SideBarUser } from "./SideBarUser";

const menu = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Transactions", url: "/admin/transactions", icon: ArrowLeftRight },
  { title: "Sensors", url: "/admin/sensors", icon: Cpu },
]

const SideBar = () => {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/admin") {
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
                    <Link href="/admin">
                    <Image src="/SSCMLogoCircle.png" alt="Logo" width={30} height={20} />
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
                <SideBarUser user={{ name: "Admin", email: "admin@example.com", avatar: "/SSCMlogo.png" }} />
            </SidebarFooter>
    </Sidebar>
  )
}
export default SideBar