'use client'

import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'
import Link from 'next/link'
import { Logo } from '@/components/landing/logo'

const links = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'FAQs', href: '#faqs' },
    { label: 'Contact', href: '#contact' },
]

export default function Footer() {
    const footerRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(footerRef.current, {
                opacity: 0,
                y: 20,
                duration: 1,
                scrollTrigger: {
                    trigger: footerRef.current,
                    start: 'top 95%',
                },
            })
        }, footerRef)

        return () => ctx.revert()
    }, [])

    return (
        <footer ref={footerRef} className="bg-background py-20 border-t border-white/5 relative overflow-hidden">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/[0.03] blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                    <div className="col-span-1">
                        <Link href="/" className="inline-block mb-6">
                            <Logo />
                        </Link>
                        <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                            Revolutionizing shoe care through intelligent automation, IoT integration, and AI-powered recognition. The future of footwear maintenance is here.
                        </p>
                    </div>

                    <div className="col-span-1">
                        <h4 className="uppercase tracking-widest text-xs mb-6">Navigation</h4>
                        <ul className="space-y-4">
                            {links.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-muted-foreground hover:text-primary transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Smart Shoe Care Machine. All rights reserved.</p>
                    <p className="flex items-center gap-2">
                        Designed for <span className="text-foreground font-bold tracking-tighter">ACADEMIC PURPOSES</span>
                    </p>
                </div>
            </div>
        </footer>
    )
}
