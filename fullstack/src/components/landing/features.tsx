'use client'

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { motion, useScroll, useTransform } from 'motion/react'
import { ScanLine, ShieldCheck, Wind, Droplets } from 'lucide-react'
import React from 'react'

const features = [
  {
    title: "Automated Cleaning",
    description: "Precision brushing and washing cycles adapted to your shoe material for a deep, gentle clean every time.",
    icon: <Droplets className="w-8 h-8 text-primary" />,
    color: "from-blue-500/20 to-cyan-500/20"
  },
  {
    title: "UV Sterilization",
    description: "Built-in UV-C light eliminates bacteria, fungi, and odor-causing microorganisms for hygienic results.",
    icon: <ShieldCheck className="w-8 h-8 text-primary" />,
    color: "from-purple-500/20 to-pink-500/20"
  },
  {
    title: "Efficient Drying",
    description: "Integrated airflow system dries your shoes quickly and evenly, preventing odor and moisture buildup.",
    icon: <Wind className="w-8 h-8 text-primary" />,
    color: "from-orange-500/20 to-yellow-500/20"
  },
  {
    title: "Image Recognition",
    description: "AI-powered camera identifies shoe type and condition to automatically select the optimal care program.",
    icon: <ScanLine className="w-8 h-8 text-primary" />,
    color: "from-green-500/20 to-emerald-500/20"
  }
]

export default function Features() {
    const containerRef = useRef<HTMLDivElement>(null)
    const cardsRef = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".feature-card", {
                y: 100,
                opacity: 0,
                scale: 0.9,
                duration: 1,
                stagger: 0.2,
                ease: "power4.out",
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            })

            // Parallax effect on icons
            cardsRef.current.forEach((card, i) => {
              if (card) {
                gsap.to(card.querySelector('.feature-icon'), {
                  y: -20,
                  ease: "none",
                  scrollTrigger: {
                    trigger: card,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                  }
                })
              }
            })
        }, containerRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={containerRef} id="features" className="relative py-16 sm:py-24 md:py-32 overflow-hidden bg-background">
            {/* Background blobs */}
            <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-3xl mb-10 sm:mb-16 md:mb-20">
                    <motion.span 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-primary font-mono text-sm uppercase tracking-[0.3em] mb-4 block"
                    >
                        Features
                    </motion.span>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter mb-6"
                    >
                        Revolutionizing Shoe Hygiene Through Smart Automation
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed"
                    >
                        Experience seamless cleaning, UV sterilization, and intelligent drying — all controlled through an integrated smart system.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                    {features.map((feature, i) => (
                        <div 
                            key={i}
                            ref={el => { cardsRef.current[i] = el }}
                            className="feature-card group relative p-5 sm:p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors overflow-hidden"
                        >
                            {/* Gradient hover background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                            
                            <div className="relative z-10">
                                <div className="feature-icon w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl bg-white/[0.05] mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Decorative corner element */}
                            <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 blur-2xl group-hover:bg-primary/20 transition-colors duration-500 rounded-full translate-x-12 translate-y-12" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

