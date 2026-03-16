import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider"

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dark landing">
      <SmoothScrollProvider>
        {children}
      </SmoothScrollProvider>
    </div>
  )
}
