import Contact from '@/components/landing/contact'
import FAQs from '@/components/landing/faqs'
import Features from '@/components/landing/features'
import Footer from '@/components/landing/footer'
import HeroSection from '@/components/landing/hero-section'
import LogoCloud from '@/components/landing/logo-cloud'
import { HeroHeader } from '@/components/landing/header'
import React from 'react'

export const metadata = {
  title: "Smart Shoe Care Machine",
  description: "Automated IoT shoe cleaning, drying, and sterilization with AI-powered image recognition.",
}

export default function LandingPage() {
  return (
    <div id="home">
      <HeroHeader />
      <HeroSection />
      <LogoCloud />
      <Features />
      <FAQs />
      <Contact />
      <Footer />
    </div>
  )
}
