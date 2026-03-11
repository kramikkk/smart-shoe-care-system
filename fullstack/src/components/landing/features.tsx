'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { ScanLine } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import React from 'react'

function useTilt(ref: React.RefObject<HTMLDivElement | null>) {
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        gsap.to(el, {
            rotateY: x * 10,
            rotateX: -y * 10,
            y: -6,
            duration: 0.3,
            ease: 'power2.out',
            transformPerspective: 800,
        })
    }
    const handleMouseLeave = () => {
        if (!ref.current) return
        gsap.to(ref.current, {
            rotateY: 0,
            rotateX: 0,
            y: 0,
            duration: 0.5,
            ease: 'elastic.out(1, 0.5)',
        })
    }
    return { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave }
}

function TiltCard({ children, className, ...rest }: { children: React.ReactNode; className?: string; [key: string]: unknown }) {
    const ref = useRef<HTMLDivElement>(null)
    const tilt = useTilt(ref)
    return (
        <Card
            ref={ref}
            className={className}
            style={{ transformStyle: 'preserve-3d' }}
            {...tilt}
            {...rest}>
            {children}
        </Card>
    )
}

export default function Features() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Heading slide-up
            gsap.from('[data-feat-heading]', {
                y: 30,
                opacity: 0,
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '[data-feat-heading]',
                    start: 'top 85%',
                    once: true,
                },
            })

            // Cards staggered entrance
            gsap.from('[data-feat-card]', {
                y: 40,
                opacity: 0,
                duration: 0.7,
                stagger: 0.15,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '[data-feat-card]',
                    start: 'top 85%',
                    once: true,
                },
            })
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="features" className="bg-background @container py-24">
            <div className="mx-auto max-w-5xl px-6">
                <div data-feat-heading>
                    <h2 className="text-balance font-serif text-4xl font-medium">Revolutionizing Shoe Hygiene Through Smart Automation</h2>
                    <p className="text-muted-foreground mt-4 text-balance">Experience seamless cleaning, UV sterilization, and intelligent drying — all controlled through an integrated smart system.</p>
                </div>
                <div className="mx-auto mt-12 max-w-3xl">
                    <div className="@xl:grid-cols-2 grid gap-3 *:p-6">
                        <TiltCard data-feat-card="" className="row-span-2 grid grid-rows-subgrid">
                            <div className="space-y-2">
                                <h3 className="text-foreground font-medium">Automated Cleaning</h3>
                                <p className="text-muted-foreground text-sm">Precision brushing and washing cycles adapted to your shoe material for a deep, gentle clean every time.</p>
                            </div>
                            <div aria-hidden className="**:fill-foreground flex h-44 flex-col justify-between pt-8">
                                <div className="relative flex h-10 items-center gap-12 px-6">
                                    <div className="bg-border absolute inset-0 my-auto h-px"></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">👟</span></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">💧</span></div>
                                </div>
                                <div className="pl-17 relative flex h-10 items-center justify-between gap-12 pr-6">
                                    <div className="bg-border absolute inset-0 my-auto h-px"></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">🫧</span></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">✨</span></div>
                                </div>
                                <div className="relative flex h-10 items-center gap-20 px-8">
                                    <div className="bg-border absolute inset-0 my-auto h-px"></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">🔄</span></div>
                                    <div className="bg-card shadow-black/6.5 ring-border relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring"><span className="text-xs">⚙️</span></div>
                                </div>
                            </div>
                        </TiltCard>

                        <TiltCard data-feat-card="" className="row-span-2 grid grid-rows-subgrid overflow-hidden">
                            <div className="space-y-2">
                                <h3 className="text-foreground font-medium">Efficient Drying</h3>
                                <p className="text-muted-foreground text-sm">Integrated airflow system dries your shoes quickly and evenly, preventing odor and moisture buildup.</p>
                            </div>
                            <div aria-hidden className="relative h-44 translate-y-6">
                                <div className="bg-foreground/15 absolute inset-0 mx-auto w-px"></div>
                                <div className="absolute -inset-x-16 top-6 aspect-square rounded-full border"></div>
                                <div className="border-primary mask-l-from-50% mask-l-to-90% mask-r-from-50% mask-r-to-50% absolute -inset-x-16 top-6 aspect-square rounded-full border"></div>
                                <div className="absolute -inset-x-8 top-24 aspect-square rounded-full border"></div>
                                <div className="mask-r-from-50% mask-r-to-90% mask-l-from-50% mask-l-to-50% absolute -inset-x-8 top-24 aspect-square rounded-full border border-lime-500"></div>
                            </div>
                        </TiltCard>

                        <TiltCard data-feat-card="" className="row-span-2 grid grid-rows-subgrid overflow-hidden">
                            <div className="space-y-2">
                                <h3 className="text-foreground font-medium">UV Sterilization</h3>
                                <p className="text-muted-foreground mt-2 text-sm">Built-in UV-C light eliminates bacteria, fungi, and odor-causing microorganisms for hygienic results.</p>
                            </div>
                            <div aria-hidden className="*:bg-foreground/15 flex h-44 justify-between pb-6 pt-12 *:h-full *:w-px">
                                <div></div><div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                                <div></div><div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                                <div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                                <div></div><div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                                <div></div><div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                                <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                                <div className="bg-primary!"></div>
                            </div>
                        </TiltCard>

                        <TiltCard data-feat-card="" className="row-span-2 grid grid-rows-subgrid">
                            <div className="space-y-2">
                                <h3 className="font-medium">Image Recognition</h3>
                                <p className="text-muted-foreground text-sm">AI-powered camera identifies shoe type and condition to automatically select the optimal care program.</p>
                            </div>
                            <div className="pointer-events-none relative -ml-7 flex size-44 items-center justify-center pt-5">
                                <ScanLine className="absolute inset-0 top-2.5 size-full stroke-[0.1px] opacity-15" />
                                <ScanLine className="size-32 stroke-[0.1px]" />
                            </div>
                        </TiltCard>
                    </div>
                </div>
            </div>
        </section>
    )
}
