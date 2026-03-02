import Contact from '@/components/landing/contact'
import Features from '@/components/landing/features'
import HeroSection from '@/components/landing/hero-section'
import LogoCloud from '@/components/landing/logo-cloud'
import React from 'react'

export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <LogoCloud />
      <Features />
      <Contact />
    </div>
  )
}
