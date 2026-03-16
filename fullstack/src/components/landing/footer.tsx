'use client'

import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'
import Link from 'next/link'
import { Logo } from '@/components/landing/logo'
import { Github, Twitter, Youtube, Linkedin } from 'lucide-react'

const links = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'FAQs', href: '#faqs' },
    { label: 'Contact', href: '#contact' },
]

const socialLinks = [
    { icon: <Github className="w-5 h-5" />, href: "#" },
    { icon: <Twitter className="w-5 h-5" />, href: "#" },
    { icon: <Youtube className="w-5 h-5" />, href: "#" },
    { icon: <Linkedin className="w-5 h-5" />, href: "#" },
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="inline-block mb-6">
                            <Logo />
                        </Link>
                        <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                            Revolutionizing shoe care through intelligent automation, IoT integration, and AI-powered recognition. The future of footwear maintenance is here.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social, i) => (
                                <a
                                    key={i}
                                    href={social.href}
                                    className="w-10 h-10 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6 uppercase tracking-widest text-xs">Navigation</h4>
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

                    <div>
                        <h4 className="font-bold text-lg mb-6 uppercase tracking-widest text-xs">Legal</h4>
                        <ul className="space-y-4">
                            <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Cookie Policy</Link></li>
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

