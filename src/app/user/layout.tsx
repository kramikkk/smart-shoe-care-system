import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SSCM User Interface",
  description: "User Interface for SSCM",
};

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen w-full flex items-center justify-center`}
        style={{
          background: "linear-gradient(120deg, #c5ffd6ff 0%, #a7ddf3ff 50%, #4d9ef5ff 100%)",
          color: "#1f2937",
        }}
      >
        <main className="w-full max-w-4xl text-center">
            {children}
        </main>
      </body>
    </html>
  );
}
