'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'
import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'
import { motion } from 'motion/react'
import { HelpCircle } from 'lucide-react'

const faqItems = [
    {
        id: 'item-1',
        question: 'How do I purchase an SSCM device?',
        answer: 'You can purchase a Smart Shoe Care Machine by contacting us through the form on this page or via email. Our team will get back to you with pricing and availability. All orders are handled manually to ensure proper setup support.',
    },
    {
        id: 'item-2',
        question: 'What does the machine actually do?',
        answer: 'The SSCM automates the full shoe care process: it cleans your shoes using precision brushing and washing cycles, dries them with an integrated airflow system, and sterilizes them using UV-C light to eliminate bacteria and odor-causing microorganisms.',
    },
    {
        id: 'item-3',
        question: 'How does the image recognition work?',
        answer: 'A built-in camera scans your shoes before each cycle. The AI model identifies the shoe type and material, then automatically selects the most appropriate cleaning, drying, and sterilization settings.',
    },
    {
        id: 'item-4',
        question: 'Is the machine safe for all shoe types?',
        answer: 'The image recognition system detects shoe materials and adjusts settings accordingly. However, we recommend avoiding use with shoes that have delicate embellishments, suede, or materials not suited for moisture exposure.',
    },
    {
        id: 'item-5',
        question: 'How do I monitor or control the machine?',
        answer: 'The SSCM connects to our web dashboard where you can monitor active cycles, view service history, and receive real-time status updates. Access is provided to registered device owners after purchase.',
    },
    {
        id: 'item-6',
        question: 'What if I need technical support?',
        answer: 'Technical support is available by contacting us through the Contact section. Support details are provided upon device registration.',
    },
]

export default function FAQs() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".faq-container", {
                y: 50,
                opacity: 0,
                duration: 1,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 80%",
                }
            })
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="faqs" className="bg-background py-32 relative overflow-hidden">
             {/* Decorative background */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/[0.02] blur-[150px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="faq-container max-w-3xl mx-auto">
                    <div className="text-center mb-16">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 1 }}
                            className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6"
                        >
                            <HelpCircle className="w-6 h-6 text-primary" />
                        </motion.div>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">Frequently Asked Questions</h2>
                        <p className="text-muted-foreground text-lg">Everything you need to know about the Smart Shoe Care Machine.</p>
                    </div>

                    <Accordion type="single" collapsible className="space-y-4">
                        {faqItems.map((item) => (
                            <AccordionItem 
                                key={item.id} 
                                value={item.id}
                                className="border border-white/5 bg-white/[0.02] rounded-2xl px-6 transition-colors hover:border-white/10 overflow-hidden"
                            >
                                <AccordionTrigger className="text-left py-6 text-lg hover:no-underline group">
                                    <span className="group-hover:text-primary transition-colors">{item.question}</span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-6 text-muted-foreground leading-relaxed text-base">
                                    {item.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-16 text-center"
                    >
                        <p className="text-muted-foreground">
                            Still have questions?{' '}
                            <Link href="#contact" className="text-primary font-bold hover:underline underline-offset-4">
                                Contact our team
                            </Link>
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

