import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import prisma from '@/lib/prisma'
import {
  broadcastClassificationResult,
  broadcastClassificationError,
} from '@/lib/websocket'

export const dynamic = 'force-dynamic'

const SHOE_TYPES = ['mesh', 'canvas', 'rubber', 'invalid', 'no_shoe']

const PROMPT = `You are the classification engine for an automated shoe-care kiosk.
Your ONLY job is to identify the PRIMARY upper material of the shoe in the image.
Ignore the sole, laces, logo patches, and toe caps — judge the UPPER only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MATERIAL DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MESH
  Visual cues: fine knit or woven synthetic fabric; you can see tiny holes or an open weave
               under close inspection; surface looks slightly textured and "airy"
  Texture: stretchy, soft, engineered knit or flyknit patterns
  Common shoes: Nike Air Max, Adidas Ultraboost, running shoes, gym trainers,
                athletic sneakers with breathable uppers
  Key test: does light pass through the upper material? are there visible perforations/holes?

CANVAS
  Visual cues: clearly woven FABRIC/TEXTILE surface; you can see individual thread crossings
               under close inspection; matte, non-reflective; looks like cloth or a cotton bag
  Texture: non-stretchy, stiff woven cotton or linen; has a consistent grid-like weave pattern
  Touch simulation: would feel rough/grainy like fabric, not smooth
  Common shoes: Converse Chuck Taylor, Vans Old Skool, Vans Slip-On, TOMS, Keds,
                classic low-tops and high-tops with obvious cloth/textile uppers
  Key test: can you see the woven thread pattern? does the surface look like fabric/textile?

RUBBER
  Visual cues: smooth, non-porous surface with NO fabric or textile texture whatsoever;
               surface looks molded or cast as one solid piece; slightly shiny or matte-smooth
               like a rubber eraser or plastic toy; no thread crossings visible at all
  Texture: solid, rigid, non-breathable; looks waterproof; uniform and featureless surface
  Common shoes: rubber rain boots, Crocs, rubber clogs, BUT ALSO classic rubber sneakers
               (common white rubber sneakers popular in Southeast Asia with smooth molded
               rubber uppers), PVC shoes, all-rubber slip-ons
  IMPORTANT: a rubber sole under a canvas or mesh upper does NOT make it "rubber" —
             only classify as rubber if the UPPER ITSELF has the smooth molded rubber surface
  Key test: is the upper surface completely smooth with zero fabric/weave texture?
            does it look like it was poured into a mold rather than sewn from cloth?

INVALID
  Use this when ANY footwear is present but cannot be serviced by this machine.
  This includes TWO categories:

  1. WRONG MATERIAL — footwear with uppers made of leather, suede, patent leather,
     nubuck, synthetic leather (PU/PVC upper), velvet, or any non-mesh/canvas/rubber fabric
     Examples: leather dress shoes, Air Force 1, Jordan 1, suede boots, loafers, oxfords,
               dress heels, platform shoes, roller skates, ice skates, cleats

  2. OPEN FOOTWEAR — ANY footwear that is open, has no closed upper, or exposes the foot
     This machine only accepts fully enclosed shoes.
     Examples: ALL slippers (hotel slippers, house slippers, slide slippers, rubber slippers),
               ALL sandals (Havaianas, Birkenstock, Teva, sports sandals, gladiator sandals),
               ALL flip flops / thong sandals,
               ALL clogs (Crocs with holes, wooden clogs, open-back clogs),
               ALL mules (backless shoes), espadrilles with open backs,
               ANY footwear where toes or heel are exposed
  Key test: is it open/exposed anywhere on top? → invalid
            is it a closed shoe but wrong material? → invalid

NO_SHOE
  Use when: the chamber appears empty, the object is not a shoe, image is too dark/blurry
            to identify anything, or a non-shoe object is placed in the chamber

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISAMBIGUATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mesh vs Canvas:
  - Mesh has HOLES or open knit structure — you can see through or into the material
  - Canvas is SOLID fabric — no holes, opaque, like a cotton tote bag texture
  - If the upper is white and looks like a classic sneaker with solid cloth → canvas
  - If the upper is multi-colored with layered knit panels → mesh
  - Nike Free, Nike Flyknit, Adidas Primeknit = MESH
  - Converse, Vans, espadrille-style cloth = CANVAS

Canvas vs Rubber:
  - Canvas has VISIBLE FABRIC WEAVE — looks like cloth, textile, threads crossing each other
  - Rubber has NO fabric texture — completely smooth surface like a rubber eraser or plastic
  - White sneakers with smooth featureless upper = RUBBER
  - White sneakers with visible cloth/thread texture on upper = CANVAS
  - When in doubt: if you can see thread crossings → canvas; if the surface is featureless smooth → rubber

Canvas vs Invalid (leather/synthetic):
  - Canvas is matte and has a visible cloth weave texture
  - Leather/synthetic leather is smooth, shiny, or semi-gloss with no weave texture
  - Air Force 1, Jordan 1, leather loafers, dress shoes = INVALID

Low confidence guidance:
  - If you cannot clearly see the upper material (bad angle, dark image, occlusion),
    lower the confidence score below 0.5
  - Never guess randomly — if genuinely uncertain between two types, pick the more
    likely one and set confidence to 0.4–0.6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON with exactly these fields:
  shoeType    — one of: mesh, canvas, rubber, invalid, no_shoe
  confidence  — float 0.0–1.0 (your certainty about the shoeType)
  subCategory — a short 2–5 word label for the specific shoe style
                Examples: "White Canvas Low-tops", "Black Mesh Running Shoes",
                "Red Rubber Rain Boots", "Brown Leather Oxford", "Pink Suede Heels",
                "White Leather Sneakers", "Navy Blue Slip-ons", "Inline Roller Skates"
                Use "" (empty string) for no_shoe.`

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params

  try {
    // Validate X-Group-Token header
    const groupToken = request.headers.get('X-Group-Token')
    if (!groupToken) {
      return NextResponse.json({ error: 'Missing X-Group-Token' }, { status: 401 })
    }

    // Look up device and verify token
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { groupToken: true },
    })

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    if (!device.groupToken || device.groupToken !== groupToken) {
      return NextResponse.json({ error: 'Invalid group token' }, { status: 401 })
    }

    // Read raw JPEG bytes from request body
    const imageBuffer = Buffer.from(await request.arrayBuffer())
    if (imageBuffer.length === 0) {
      return NextResponse.json({ error: 'Empty image body' }, { status: 400 })
    }

    // Call Gemini with inline base64 JPEG
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBuffer.toString('base64'),
          },
        },
        { text: PROMPT },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            shoeType:    { type: 'string' },
            confidence:  { type: 'number' },
            subCategory: { type: 'string' },
          },
          required: ['shoeType', 'confidence', 'subCategory'],
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '{}') as {
      shoeType?: string
      confidence?: number
      subCategory?: string
    }

    const shoeType    = parsed.shoeType ?? ''
    const confidence  = typeof parsed.confidence === 'number' ? parsed.confidence : 0
    const subCategory = parsed.subCategory ?? ''

    console.log(`[Classify] Gemini raw response for ${deviceId}:`, JSON.stringify(parsed))

    // Validate against allowlist
    if (!SHOE_TYPES.includes(shoeType)) {
      console.error(`[Classify] Unknown shoeType from Gemini: "${shoeType}" for ${deviceId}`)
      broadcastClassificationError(deviceId, 'Classification returned an unknown shoe type')
      return NextResponse.json({ error: 'Unknown shoe type' }, { status: 422 })
    }

    console.log(`[Classify] ${deviceId}: ${shoeType} — ${subCategory} (${(confidence * 100).toFixed(1)}%)`)
    broadcastClassificationResult(deviceId, shoeType, confidence, subCategory)

    return NextResponse.json({ ok: true, shoeType, confidence, subCategory })
  } catch (error) {
    console.error('[Classify] Error:', error)
    broadcastClassificationError(deviceId, 'Classification failed — please try again')
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 })
  }
}
