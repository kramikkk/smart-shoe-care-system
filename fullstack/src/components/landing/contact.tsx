'use client'

import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function Contact() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from('[data-contact-inner]', {
                y: 30,
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '[data-contact-inner]',
                    start: 'top 85%',
                    once: true,
                },
            })
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="contact" className="bg-background @container py-24">
            <div data-contact-inner className="mx-auto max-w-2xl px-6">
                <div className="text-center">
                    <h1 className="text-balance font-serif text-4xl font-medium sm:text-5xl">Get Your SSCM Device</h1>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-md text-balance">Interested in purchasing a Smart Shoe Care Machine? Reach out to us and we'll get back to you with pricing and availability.</p>
                </div>

                <Card className="mt-12 p-8">
                    <form
                        action=""
                        className="space-y-5">
                        <div className="@md:grid-cols-2 grid gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="firstName"
                                    className="text-sm">
                                    First name
                                </Label>
                                <Input
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="lastName"
                                    className="text-sm">
                                    Last name
                                </Label>
                                <Input
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="email"
                                className="text-sm">
                                Email address
                            </Label>
                            <Input
                                type="email"
                                id="email"
                                name="email"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="phone"
                                className="text-sm">
                                Phone number
                            </Label>
                            <Input
                                type="tel"
                                id="phone"
                                name="phone"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="message"
                                className="text-sm">
                                Message
                            </Label>
                            <Textarea
                                id="message"
                                name="message"
                                rows={5}
                                placeholder="Tell us about your needs or any questions you have..."
                                className="min-h-28"
                            />
                        </div>

                        <Button className="w-full">Send Inquiry</Button>
                    </form>
                </Card>

                <p className="text-muted-foreground mt-6 text-center text-sm">
                    By submitting, you agree to our{' '}
                    <a
                        href="#"
                        className="text-foreground underline">
                        Privacy Policy
                    </a>
                </p>
            </div>
        </section>
    )
}
