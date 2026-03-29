'use client'

import { useRef, useEffect, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'motion/react'
import { Mail, Phone, MapPin, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function Contact() {
    const sectionRef = useRef<HTMLElement>(null)
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [fields, setFields] = useState({ firstName: '', lastName: '', email: '', message: '' })

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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setStatus('loading')
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            })
            if (!res.ok) throw new Error()
            setStatus('success')
            setFields({ firstName: '', lastName: '', email: '', message: '' })
        } catch {
            setStatus('error')
        }
    }

    return (
        <section ref={sectionRef} id="contact" className="bg-background py-16 sm:py-24 md:py-32 relative overflow-hidden border-t border-white/5">
            <div className="container mx-auto px-6 max-w-7xl relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-start">
                    <div className="contact-content max-w-xl">
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-primary font-mono text-sm uppercase tracking-[0.3em] mb-4 block"
                        >
                            Contact
                        </motion.span>
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter mb-6 md:mb-8 leading-[1.1]">
                            Ready to Elevate Your Shoe Care?
                        </h2>
                        <p className="text-base sm:text-xl text-muted-foreground mb-8 md:mb-12 leading-relaxed">
                            Interested in purchasing a Smart Shoe Care Machine? Reach out to us and we'll get back to you with pricing, availability, and technical details.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-center gap-6 group">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <Mail className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Email</p>
                                    <p className="text-base sm:text-lg font-medium">sscm.contact@gmail.com</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 group">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <Phone className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Phone</p>
                                    <p className="text-base sm:text-lg font-medium">+639608319790</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 group">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                                    <p className="text-base sm:text-lg font-medium">Laguna, PH</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="contact-form bg-white/[0.02] border border-white/5 p-5 sm:p-8 md:p-12 rounded-[2rem] backdrop-blur-xl relative group">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2rem] pointer-events-none" />

                        <form className="relative z-10 space-y-6" onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-xs uppercase tracking-widest text-muted-foreground">First Name</Label>
                                    <Input
                                        id="firstName"
                                        className="bg-white/5 border-white/5 focus:border-primary/50 h-12"
                                        required
                                        value={fields.firstName}
                                        onChange={e => { setFields(f => ({ ...f, firstName: e.target.value })); if (status === 'error') setStatus('idle') }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-xs uppercase tracking-widest text-muted-foreground">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        className="bg-white/5 border-white/5 focus:border-primary/50 h-12"
                                        required
                                        value={fields.lastName}
                                        onChange={e => { setFields(f => ({ ...f, lastName: e.target.value })); if (status === 'error') setStatus('idle') }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">Email Address</Label>
                                <Input
                                    type="email"
                                    id="email"
                                    className="bg-white/5 border-white/5 focus:border-primary/50 h-12"
                                    required
                                    value={fields.email}
                                    onChange={e => { setFields(f => ({ ...f, email: e.target.value })); if (status === 'error') setStatus('idle') }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message" className="text-xs uppercase tracking-widest text-muted-foreground">Message</Label>
                                <Textarea
                                    id="message"
                                    rows={4}
                                    className="bg-white/5 border-white/5 focus:border-primary/50 resize-none"
                                    placeholder="Tell us about your needs..."
                                    required
                                    value={fields.message}
                                    onChange={e => { setFields(f => ({ ...f, message: e.target.value })); if (status === 'error') setStatus('idle') }}
                                />
                            </div>

                            {status === 'success' && (
                                <div className="flex items-center gap-3 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm">
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    Message sent! We'll get back to you soon.
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="flex items-center gap-3 text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Something went wrong. Please try again or email us directly.
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={status === 'loading' || status === 'success'}
                                className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold group overflow-hidden relative disabled:opacity-70"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {status === 'loading' ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                                    ) : status === 'success' ? (
                                        <><CheckCircle className="w-5 h-5" /> Sent!</>
                                    ) : (
                                        <>Send Inquiry <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
                                    )}
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

