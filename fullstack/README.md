# Fullstack

Next.js 16 web application for the Smart Shoe Care System. It serves the customer-facing kiosk UI, the client owner dashboard, the admin panel, and acts as the real-time backend bridge between the web UI and ESP32 hardware devices over WebSocket.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.9 |
| Runtime | Node.js ≥ 20 (custom server via `server.ts`) |
| Styling | Tailwind CSS 4, Radix UI, shadcn/ui |
| Charts | Recharts 2 |
| Animation | GSAP 3, Motion, Lenis |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 |
| Auth | Better Auth 1.3 |
| Payments | PayMongo (OAuth + manual API key) |
| WebSocket | `ws` 8 |
| AI | Google Gemini 2.0 Flash (shoe classification), Anthropic Claude SDK |
| Email | Nodemailer + Gmail OAuth2 |
| Validation | Zod 4 |

---

## Route Map

| Route | Surface | Notes |
|-------|---------|-------|
| `/` | Public landing page | Marketing site |
| `/kiosk/*` | Customer kiosk UI | Runs on tablet inside the machine |
| `/client/*` | Client owner dashboard | Device monitoring, transactions, analytics, payment setup |
| `/admin/*` | Admin panel | User management, device management, pricing, diagnostics |
| `/api/*` | REST + WebSocket API | Consumed by ESP32 hardware and web UI |

---

## Database Schema

Key Prisma models:

| Model | Purpose |
|-------|---------|
| `User` | Accounts with roles (`admin`, `client`) and ban support |
| `Session` / `Account` / `Verification` | Better Auth managed tables |
| `Device` | Registered kiosk machines with pairing state and camera sync |
| `Transaction` | Service transactions with status (`ACTIVE`, `COMPLETED`, `INTERRUPTED`, `ABANDONED`) |
| `ServicePricing` | Per-device pricing for each service type and care level |
| `ServiceDuration` | Per-device duration settings |
| `CleaningDistance` | Side linear actuator depth per care type (gentle/normal/strong) in mm |
| `MotorSpeed` | Brush motor PWM per care type |
| `DryingTemp` | Drying temperature setpoint per care type |
| `ClientPaymentConfig` | Encrypted PayMongo credentials per client |
| `PaymentIntentMap` | Maps in-progress payment intents to devices and clients |
| `DeviceAlert` | Device alerts with severity and resolution tracking |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Auth signing secret — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Public base URL of this server (e.g. `http://localhost:3000`) |
| `TRUSTED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `GEMINI_API_KEY` | Yes | Google AI Studio API key — server-side only, no `NEXT_PUBLIC_` prefix |
| `PAYMENT_CREDENTIALS_MASTER_KEY` | Yes | 32-byte base64 key for encrypting stored payment credentials |
| `WS_AUTH_TOKEN` | Yes | Token ESP32 devices use to authenticate WebSocket connections |
| `GMAIL_USER` | No | Gmail address for contact form emails |
| `GMAIL_CLIENT_ID` | No | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | No | Google OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | No | Google OAuth2 refresh token |
| `NEXT_PUBLIC_DEBUG` | No | Set to `"true"` to enable browser console debug logs |
| `WS_VERBOSE` | No | Set to `"true"` for verbose WebSocket server logging |

---

## Setup & Development

```bash
cd fullstack
npm install
cp .env.example .env        # fill in all required variables
npx prisma migrate dev      # apply schema migrations
npm run dev                 # start dev server on http://localhost:3000
```

The dev server uses `tsx` to run `server.ts` directly with the `.env` file loaded.

### Create the first admin user

```bash
npx tsx scripts/create-admin.ts
```

---

## Build & Production

```bash
npm run build   # prisma generate → next build → esbuild server bundle
npm start       # runs dist/server.js (production Node.js server)
```

The production server is a single bundled Node.js file at `dist/server.js` built by esbuild. It starts Next.js and the custom WebSocket server in the same process.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (tsx + .env auto-loaded) |
| `npm run build` | Full production build (Prisma generate + Next build + server bundle) |
| `npm run build:server` | Build server bundle only (esbuild) |
| `npm start` | Start production server from `dist/server.js` |
| `npm run test:payments` | Run payment module unit tests |

---

## Architecture Notes

### Custom Server

The app uses a custom Node.js entry point (`server.ts`) instead of `next start`. This server:
- Starts the Next.js request handler
- Starts a `ws` WebSocket server on the same HTTP port
- Manages connected ESP32 device sessions and routes real-time messages between devices and browser clients

### WebSocket Lifecycle

ESP32 devices connect on boot, authenticate with `WS_AUTH_TOKEN`, and register their `deviceId`. The backend keeps a live map of connected devices and uses it to forward service commands from the web UI to the correct machine and to broadcast classification results and status updates back to the kiosk UI.

### Key Source Files

| File | Purpose |
|------|---------|
| `server.ts` | Entry point — HTTP + WebSocket server |
| `src/lib/websocket.ts` | WebSocket server logic, device session map, broadcast helpers |
| `src/app/api/device/[deviceId]/classify/route.ts` | Gemini shoe classification endpoint |
| `src/app/kiosk/` | Kiosk UI pages (classify, service selection, payment, progress) |
| `src/app/client/` | Client dashboard pages |
| `src/app/admin/` | Admin panel pages |
| `src/lib/auth-middleware.ts` | Route protection and role checks |
| `src/lib/prisma.ts` | Prisma client singleton |
| `prisma/schema.prisma` | Full database schema |
