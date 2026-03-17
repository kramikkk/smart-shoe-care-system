'use client'

import { motion } from 'motion/react'
import HeroSection from '@/components/landing/hero-section'
import LogoCloud from '@/components/landing/logo-cloud'
import Features from '@/components/landing/features'
import FAQs from '@/components/landing/faqs'
import Contact from '@/components/landing/contact'
import Footer from '@/components/landing/footer'

export default function AnimatedSections() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <HeroSection />
      <LogoCloud />
      <Features />
      <FAQs />
      <Contact />
      <Footer />
    </motion.div>
  )
}
