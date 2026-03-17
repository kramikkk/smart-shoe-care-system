import { HeroHeader } from '@/components/landing/header'
import AnimatedSections from '@/components/landing/animated-sections'

export const metadata = {
  title: "Smart Shoe Care Machine",
  description: "Automated IoT shoe cleaning, drying, and sterilization with AI-powered image recognition.",
}

export default function LandingPage() {
  return (
    <div id="home">
      <HeroHeader />
      <AnimatedSections />
    </div>
  )
}
