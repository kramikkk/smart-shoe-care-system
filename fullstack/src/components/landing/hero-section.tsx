import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import { ChevronRight } from 'lucide-react'
import Image from 'next/image'

export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <section id="home" className="bg-background">
                    <div className="relative py-40">
                        <div className="mask-radial-from-45% mask-radial-to-75% mask-radial-at-top mask-radial-[75%_100%] aspect-2/3 absolute inset-0 opacity-75 blur-xl md:aspect-square lg:aspect-video dark:opacity-5">
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
                                    <p className="text-muted-foreground mt-4 text-balance">An IoT Automated Solution for Cleaning, Sterilization and Drying Shoes with Integrated Image Recognition</p>

                                    <Button
                                        asChild
                                        className="mt-6 pr-1.5">
                                        <Link href="/admin/login">
                                            <span className="text-nowrap">Get Started</span>
                                            <ChevronRight className="opacity-50" />
                                        </Link>
                                    </Button>
                                </div>
                                <div className="flex items-center justify-center max-md:mt-10">
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
