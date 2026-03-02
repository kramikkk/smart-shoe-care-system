'use client'
import { useEffect, useState } from 'react'
import { NextJS } from '@/components/ui/svgs/nextjs'
import { TailwindCSS } from '@/components/ui/svgs/tailwindcss'
import { TypeScript } from '@/components/ui/svgs/typescript'
import { NeonDB } from '@/components/ui/svgs/neondb'
import { Prisma } from '@/components/ui/svgs/prisma'
import { Vercel } from '@/components/ui/svgs/vercel'
import { AnimatePresence, motion } from 'motion/react'
import React from 'react'

const frontendLogos: React.ReactNode[] = [
    <span key="nextjs" className="flex items-center gap-2"><NextJS className="size-8 shrink-0" /><span className="text-sm font-medium">Next.js</span></span>,
    <span key="tailwind" className="flex items-center gap-2"><TailwindCSS className="size-8 shrink-0" /><span className="text-sm font-medium">Tailwind CSS</span></span>,
    <span key="typescript" className="flex items-center gap-2"><TypeScript className="size-8 shrink-0" /><span className="text-sm font-medium">TypeScript</span></span>,
]

const backendLogos: React.ReactNode[] = [
    <span key="neondb" className="flex items-center gap-2"><NeonDB className="size-8 shrink-0" /><span className="text-sm font-medium">NeonDB</span></span>,
    <span key="prisma" className="flex items-center gap-2"><Prisma className="size-8 shrink-0" /><span className="text-sm font-medium">Prisma</span></span>,
    <span key="vercel" className="flex items-center gap-2"><Vercel className="size-8 shrink-0" /><span className="text-sm font-medium">Vercel</span></span>,
]

type LogoGroup = 'frontend' | 'backend'

const logos: { [key in LogoGroup]: React.ReactNode[] } = {
    frontend: frontendLogos,
    backend: backendLogos,
}

export default function LogoCloud() {
    const [currentGroup, setCurrentGroup] = useState<LogoGroup>('frontend')

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentGroup((prev) => {
                const groups = Object.keys(logos) as LogoGroup[]
                const currentIndex = groups.indexOf(prev)
                const nextIndex = (currentIndex + 1) % groups.length
                return groups[nextIndex]
            })
        }, 2500)

        return () => clearInterval(interval)
    }, [])

    return (
        <section className="bg-background py-12">
            <div className="mx-auto max-w-5xl px-6">
                <div className="mx-auto grid h-12 max-w-2xl grid-cols-3 items-center gap-8">
                    <AnimatePresence
                        initial={false}
                        mode="popLayout">
                        {logos[currentGroup].map((logo, i) => (
                            <motion.div
                                key={`${currentGroup}-${i}`}
                                className="**:fill-foreground! flex items-center justify-center"
                                initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 12, filter: 'blur(6px)', scale: 0.5 }}
                                transition={{ delay: i * 0.1, duration: 1.5, type: 'spring', bounce: 0.2 }}>
                                {logo}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
