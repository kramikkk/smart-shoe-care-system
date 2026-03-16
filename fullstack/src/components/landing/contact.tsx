'use client'

import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'motion/react'
import { Mail, Phone, MapPin, Send } from 'lucide-react'

export default function Contact() {
    const sectionRef = useRef<HTMLElement>(null)
    const formRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".contact-content", {
                x: -50,
                opacity: 0,
                duration: 1,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 70%",
                }
            })
            gsap.from(".contact-form", {
                x: 50,
                opacity: 0,
                duration: 1,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 70%",
                }
            })
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="contact" className="bg-background py-32 relative overflow-hidden border-t border-white/5">
            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                    <div className="contact-content max-w-xl">
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-primary font-mono text-sm uppercase tracking-[0.3em] mb-4 block"
                        >
                            Contact
                        </motion.span>
                        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-8 leading-[1.1]">
                            Ready to Elevate Your Shoe Care?
                        </h2>
                        <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
                            Interested in purchasing a Smart Shoe Care Machine? Reach out to us and we'll get back to you with pricing, availability, and technical details.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-center gap-6 group">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <Mail className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Email</p>
                                    <p className="text-lg font-medium">sscm.contact@gmail.com</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 group">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <Phone className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Phone</p>
                                    <p className="text-lg font-medium">+1 (555) 123-4567</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 group">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                                    <p className="text-lg font-medium">Laguna, PH</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="contact-form bg-white/[0.02] border border-white/5 p-8 md:p-12 rounded-[2rem] backdrop-blur-xl relative group">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2rem] pointer-events-none" />

                        <form className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-xs uppercase tracking-widest text-muted-foreground">First Name</Label>
                                    <Input id="firstName" className="bg-white/5 border-white/5 focus:border-primary/50 h-12" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-xs uppercase tracking-widest text-muted-foreground">Last Name</Label>
                                    <Input id="lastName" className="bg-white/5 border-white/5 focus:border-primary/50 h-12" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">Email Address</Label>
                                <Input type="email" id="email" className="bg-white/5 border-white/5 focus:border-primary/50 h-12" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message" className="text-xs uppercase tracking-widest text-muted-foreground">Message</Label>
                                <Textarea id="message" rows={4} className="bg-white/5 border-white/5 focus:border-primary/50 resize-none" placeholder="Tell us about your needs..." required />
                            </div>

                            <Button className="w-full h-14 rounded-xl text-lg font-bold group overflow-hidden relative">
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    Send Inquiry
                                    <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </span>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Background element */}
            <div className="absolute top-[10%] right-[-10%] w-[40%] aspect-square rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        </section>
    )
}

