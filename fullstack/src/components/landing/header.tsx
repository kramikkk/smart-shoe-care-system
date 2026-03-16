'use client'
import Link from 'next/link'
import { Logo } from '@/components/landing/logo'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import React from 'react'
import { cn } from '@/lib/utils'

const menuItems = [
    { name: 'Home', href: '#home' },
    { name: 'Features', href: '#features' },
    { name: 'FAQs', href: '#faqs' },
    { name: 'Contact Us', href: '#contact' },
]

interface HeroHeaderProps {
    threshold?: number
}

export const HeroHeader = ({ threshold = 50 }: HeroHeaderProps) => {
    const [menuState, setMenuState] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > threshold)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [threshold])

    return (
        <header className="relative z-[100]">
            <nav
                data-state={menuState && 'active'}
                className={cn(
                    'fixed inset-x-0 top-0 w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isScrolled
                        ? 'bg-background/80 border-b border-white/5 backdrop-blur-xl py-4'
                        : 'bg-transparent py-8'
                )}
            >
                <div className="mx-auto max-w-7xl px-6">
                    <div className="relative flex items-center justify-between">
                        <Link
                            href="/"
                            aria-label="home"
                            className="flex items-center space-x-2 relative z-[110]">
                            <Logo />
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden lg:block absolute left-1/2 -translate-x-1/2">
                            <ul className="flex items-center gap-8">
                                {menuItems.map((item, index) => (
                                    <li key={index}>
                                        <Link href={item.href} className="group py-2 block">
                                            <div className="relative overflow-hidden">
                                                <span className="block text-sm font-medium uppercase tracking-widest text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">
                                                    {item.name}
                                                </span>
                                                <span className="absolute inset-0 block text-sm font-medium uppercase tracking-widest text-primary transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] translate-y-full group-hover:translate-y-0">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex items-center gap-6 relative z-[110]">
                            <div className="hidden lg:flex items-center gap-4">
                                <Button asChild variant="ghost" size="sm" className="hover:bg-white/5 uppercase tracking-widest text-xs">
                                    <Link href="/client/login">Login</Link>
                                </Button>
                                <Button asChild size="sm" className="rounded-full px-6 uppercase tracking-widest text-xs font-bold">
                                    <Link href="/client/login">Join Now</Link>
                                </Button>
                            </div>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                className="lg:hidden relative size-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10"
                            >
                                <Menu className={cn("size-5 transition-all duration-300 absolute", menuState ? "opacity-0 scale-0 rotate-90" : "opacity-100 scale-100 rotate-0")} />
                                <X className={cn("size-5 transition-all duration-300 absolute", menuState ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-0 -rotate-90")} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                <div className={cn(
                    "fixed inset-0 bg-background/95 backdrop-blur-2xl lg:hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top",
                    menuState ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
                )}>
                    <div className="flex flex-col items-center justify-center h-full gap-8">
                        {menuItems.map((item, index) => (
                            <Link
                                key={index}
                                href={item.href}
                                onClick={() => setMenuState(false)}
                                className="text-3xl font-bold tracking-tighter hover:text-primary transition-colors"
                            >
                                {item.name}
                            </Link>
                        ))}
                        <Button asChild size="lg" className="mt-8 rounded-full px-12">
                            <Link href="/client/login">Get Started</Link>
                        </Button>
                    </div>
                </div>
            </nav>
        </header>
    )
}

