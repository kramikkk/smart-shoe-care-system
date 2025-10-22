import SideBar from "@/components/SideBar";
import NavBar from "@/components/NavBar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/dist/server/request/cookies";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies()
    const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <SideBar/>
            <SidebarInset>
            <main className="w-full">
                <NavBar/>
                <div className="px-4 pb-4">
                    <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                    ></ThemeProvider>
                    {children}
                </div>
            </main>
            </SidebarInset>
        </SidebarProvider>
    );
}




