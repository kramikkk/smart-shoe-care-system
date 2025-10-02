import SideBar from "@/components/SideBar";
import NavBar from "@/components/NavBar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <SidebarProvider>
            <SideBar/>
            <main className="w-full">
                <NavBar/>
                <div className="px-4">
                    <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                    ></ThemeProvider>
                    {children}
                </div>
            </main>
        </SidebarProvider>
    );
}




