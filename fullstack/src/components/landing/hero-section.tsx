'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import { ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { gsap, ScrollTrigger } from '@/lib/gsap'

export default function HeroSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const bgRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Word-by-word heading animation
            const heading = containerRef.current?.querySelector('h1')
            if (heading) {
                const words = heading.textContent?.split(' ') ?? []
                heading.innerHTML = words
                    .map((w) => `<span class="inline-block overflow-hidden"><span class="inline-block word-reveal">${w}</span></span>`)
                    .join(' ')

                gsap.from('.word-reveal', {
                    y: '110%',
                    opacity: 0,
                    duration: 0.8,
                    stagger: 0.1,
                    ease: 'power3.out',
                })
            }

            // Subtitle + CTA fade in
            gsap.from('[data-hero-sub]', {
                y: 20,
                opacity: 0,
                duration: 0.7,
                delay: 0.6,
                ease: 'power2.out',
            })

            gsap.from('[data-hero-btn]', {
                y: 20,
                opacity: 0,
                duration: 0.7,
                delay: 0.8,
                ease: 'power2.out',
            })

            // Logo image entrance + float loop
            if (imageRef.current) {
                gsap.from(imageRef.current, {
                    scale: 0.85,
                    opacity: 0,
                    duration: 1,
                    delay: 0.3,
                    ease: 'power2.out',
                })

                gsap.to(imageRef.current, {
                    y: -8,
                    duration: 3,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    delay: 1.3,
                })
            }

            // Background parallax
            if (bgRef.current) {
                gsap.to(bgRef.current, {
                    y: '30%',
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top top',
                        end: 'bottom top',
                        scrub: true,
                    },
                })
            }
        }, containerRef)

        return () => ctx.revert()
    }, [])

    // Magnetic CTA effect
    const handleBtnMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const btn = e.currentTarget
        const rect = btn.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' })
    }

    const handleBtnMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
        gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
    }

    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden" ref={containerRef}>
                <section id="home" className="bg-background">
                    <div className="relative py-40">
                        <div
                            ref={bgRef}
                            className="mask-radial-from-45% mask-radial-to-75% mask-radial-at-top mask-radial-[75%_100%] aspect-2/3 absolute inset-0 opacity-75 blur-xl md:aspect-square lg:aspect-video dark:opacity-5">
                            <Image
                                src="https://images.unsplash.com/photo-1685013640715-8701bbaa2207?q=80&w=2198&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt="hero background"
                                width={2198}
                                height={1685}
                                className="h-full w-full object-cover object-top"
                            />
                        </div>
                        <div className="relative z-10 mx-auto w-full max-w-5xl sm:pl-6">
                            <div className="flex items-center justify-between max-md:flex-col">
                                <div className="max-w-md max-sm:px-6">
                                    <h1 className="text-balance font-serif text-4xl font-medium sm:text-5xl">Smart Shoe Care Machine</h1>
                                    <p {...{ 'data-hero-sub': '' }} className="text-muted-foreground mt-4 text-balance">An IoT Automated Solution for Cleaning, Sterilization and Drying Shoes with Integrated Image Recognition</p>

                                    <Button
                                        asChild
                                        className="mt-6 pr-1.5">
                                        <Link
                                            href="/client/login"
                                            onMouseMove={handleBtnMouseMove}
                                            onMouseLeave={handleBtnMouseLeave}
                                            {...{ 'data-hero-btn': '' }}>
                                            <span className="text-nowrap">Get Started</span>
                                            <ChevronRight className="opacity-50" />
                                        </Link>
                                    </Button>
                                </div>
                                <div
                                    ref={imageRef}
                                    className="flex items-center justify-center max-md:mt-10">
                                    <Image
                                        src="/SSCMlogoTrans.png"
                                        alt="Smart Shoe Care Machine"
                                        width={400}
                                        height={400}
                                        className="object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
