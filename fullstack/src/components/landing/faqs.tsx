'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'
import { useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap'

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
            gsap.from('[data-faq-heading]', {
                y: 30,
                opacity: 0,
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '[data-faq-heading]',
                    start: 'top 85%',
                    once: true,
                },
            })

            gsap.from('[data-faq-item]', {
                x: -20,
                opacity: 0,
                duration: 0.6,
                stagger: 0.08,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '[data-faq-item]',
                    start: 'top 85%',
                    once: true,
                },
            })
        }, sectionRef)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="faqs" className="bg-background @container py-24">
            <div className="mx-auto max-w-2xl px-6">
                <h2 data-faq-heading className="text-center font-serif text-4xl font-medium">Frequently Asked Questions</h2>
                <Accordion
                    type="single"
                    collapsible
                    className="mt-12">
                    {faqItems.map((item) => (
                        <div
                            data-faq-item
                            className="group"
                            key={item.id}>
                            <AccordionItem
                                value={item.id}
                                className="data-[state=open]:bg-muted/50 peer rounded-xl border-none px-5 py-1 transition-colors">
                                <AccordionTrigger className="cursor-pointer py-4 text-sm font-medium hover:no-underline">{item.question}</AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-muted-foreground pb-2 text-sm">{item.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                            <hr className="mx-5 group-last:hidden peer-data-[state=open]:opacity-0" />
                        </div>
                    ))}
                </Accordion>
                <p className="text-muted-foreground mt-8 text-center text-sm">
                    Still have questions?{' '}
                    <Link
                        href="#contact"
                        className="text-primary font-medium hover:underline">
                        Contact us
                    </Link>
                </p>
            </div>
        </section>
    )
}
