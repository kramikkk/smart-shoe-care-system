import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
    const { firstName, lastName, email, message } = await req.json()

    if (!firstName || !lastName || !email || !message) {
        return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const contactEmail = process.env.CONTACT_EMAIL
    if (!contactEmail) {
        console.error('[contact] CONTACT_EMAIL env var is not set')
        return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
    }

    const safeName    = escapeHtml(`${firstName} ${lastName}`)
    const safeEmail   = escapeHtml(email)
    const safeMessage = escapeHtml(message)

    const { error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: contactEmail,
        replyTo: email,
        subject: `New Inquiry from ${safeName}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">New Inquiry — Smart Shoe Care Machine</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #555; width: 120px;">Name</td>
                        <td style="padding: 8px 0; font-weight: 600;">${safeName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #555;">Email</td>
                        <td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
                    </tr>
                </table>
                <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
                <h3 style="color: #1a1a1a;">Message</h3>
                <p style="color: #333; white-space: pre-wrap;">${safeMessage}</p>
            </div>
        `,
    })

    if (error) {
        console.error('[contact] Resend error:', error)
        return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
