import Contact from '@/components/landing/contact'
import FAQs from '@/components/landing/faqs'
import Features from '@/components/landing/features'
import Footer from '@/components/landing/footer'
import HeroSection from '@/components/landing/hero-section'
import LogoCloud from '@/components/landing/logo-cloud'
import React from 'react'

export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <LogoCloud />
      <Features />
      <FAQs />
      <Contact />
      <Footer />
    </div>
  )
}
