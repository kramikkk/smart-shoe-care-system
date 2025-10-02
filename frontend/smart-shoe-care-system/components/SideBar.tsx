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
} from "@/components/ui/sidebar"
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftRight, Cpu, LayoutDashboard,  } from "lucide-react";

const menu = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Transactions", url: "/admin/transactions", icon: ArrowLeftRight },
  { title: "Sensors", url: "/student/sensors", icon: Cpu },
]

const SideBar = () => {
  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
        <SidebarHeader className="py-4">
            <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href="/admiN">
                    <Image src="/globe.svg" alt="Logo" width={20} height={20} />
                    <span className=" text-base font-bold">Smart Shoe Care</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                    <SidebarMenu>
                        {menu.map((item) => {
                        const Icon = item.icon;
                        return (
                            <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                                <a href={item.url} className="flex items-center gap-2">
                                <Icon className="w-5 h-5" />
                                <span>{item.title}</span>
                                </a>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                        })}
                    </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
    </Sidebar>
  )
}
export default SideBar