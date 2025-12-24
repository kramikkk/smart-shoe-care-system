import './kiosk.css'

export default function UserLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <div className="h-screen w-screen bg-gradient-to-r from-green-200 via-cyan-200 to-blue-400 text-gray-900 flex items-center justify-center">
            {children}
        </div>
    );
}