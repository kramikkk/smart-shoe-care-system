'use client'

import React from 'react'
import { NextJS } from '@/components/ui/svgs/nextjs'
import { TailwindCSS } from '@/components/ui/svgs/tailwindcss'
import { TypeScript } from '@/components/ui/svgs/typescript'
import { NeonDB } from '@/components/ui/svgs/neondb'
import { Prisma } from '@/components/ui/svgs/prisma'
import { Vercel } from '@/components/ui/svgs/vercel'
import { motion } from 'motion/react'

const techLogos = [
    { name: 'Next.js', icon: <NextJS className="w-8 h-8" /> },
    { name: 'Tailwind CSS', icon: <TailwindCSS className="w-8 h-8" /> },
    { name: 'TypeScript', icon: <TypeScript className="w-8 h-8" /> },
    { name: 'NeonDB', icon: <NeonDB className="w-8 h-8" /> },
    { name: 'Prisma', icon: <Prisma className="w-8 h-8" /> },
    { name: 'Vercel', icon: <Vercel className="w-8 h-8" /> },
]

export default function LogoCloud() {
    return (
        <section className="py-20 bg-background border-y border-white/5 overflow-hidden">
            <div className="container mx-auto px-6 mb-12 text-center">
                <span className="text-muted-foreground/50 text-xs sm:text-sm uppercase tracking-[0.5em]">Powered by industry leading technology</span>
            </div>
            
            <div className="relative flex overflow-hidden group">
                <motion.div 
                    animate={{ x: [0, -1000] }}
                    transition={{ 
                        duration: 30, 
                        repeat: Infinity, 
                        ease: "linear" 
                    }}
                    className="flex gap-8 sm:gap-12 md:gap-20 items-center whitespace-nowrap"
                >
                    {[...techLogos, ...techLogos, ...techLogos, ...techLogos].map((logo, i) => (
                        <div key={i} className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors grayscale hover:grayscale-0 opacity-50 hover:opacity-100 duration-500">
                            {logo.icon}
                            <span className="text-xl font-bold tracking-tighter uppercase">{logo.name}</span>
                        </div>
                    ))}
                </motion.div>
                
                {/* Gradient Masks */}
                <div className="absolute inset-y-0 left-0 w-16 sm:w-24 md:w-40 bg-gradient-to-r from-background to-transparent z-10" />
                <div className="absolute inset-y-0 right-0 w-16 sm:w-24 md:w-40 bg-gradient-to-l from-background to-transparent z-10" />
            </div>
        </section>
    )
}

