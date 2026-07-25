# Sentinel

**AI-assisted family calls for eldercare.** You call your parent; Sentinel quietly
listens in and turns the conversation into gentle, structured wellbeing feedback
you can read in the app.

> Sentinel **never calls on its own** and **never replaces hearing a loved one's
> voice** — that connection is part of care. A family member makes the call
> themselves; Sentinel only observes and analyses, and never diagnoses.

---

## Table of contents

- [What it does](#what-it-does)
- [How a call works](#how-a-call-works)
- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API routes](#api-routes)
- [The `Conversation` data model](#the-conversation-data-model)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Real calls (Twilio)](#real-calls-twilio)
- [Design principles](#design-principles)
- [Scripts](#scripts)
- [Status & roadmap](#status--roadmap)
- [Disclaimer](#disclaimer)

---

## What it does

The person using the app is simply **someone checking on their parent** — no
"caregiver" label, no account name, no phone number of their own. They:

1. Add one or more parents (name + phone number) in **Settings**.
2. Press **Call Parent** and talk through the app (their voice runs through the
   browser; the parent answers on a normal phone — nothing to install).
3. After hanging up, get a **plain-language summary** and **wellbeing signals** on
   the dashboard.

Sentinel analyses four streams from what was actually said and compares them to
the parent's **own** history (never a population norm):

| Stream | Extracts |
| --- | --- |
| **Nutrition** | meals, snacks, drinks, appetite, hydration, protein, skipped meals, weight mentions |
| **Vocal biomarkers** | speech pace, vocal energy, confidence, hesitation, clarity, emotional tone, engagement, response latency (as % of the parent's baseline) |
| **Medication** | mentioned, confirmed, missed, supplements, timing |
| **Hydration** | glasses vs. a personal target, fluid-rich foods, trend |

---

## How a call works

```
You press "Call Parent"
        ↓
You talk through the app · your parent answers their normal phone (via Twilio)
        ↓
Natural family conversation — Sentinel stays out of the way
        ↓
Call is recorded, then transcribed (OpenAI speech-to-text)
        ↓
AI analyses the transcript → Nutrition · Vocal biomarkers · Medication · Hydration
        ↓
Health signals generated (each with confidence + evidence + reason)
        ↓
Caregiver summary written · wellbeing score & Green/Amber/Red band
        ↓
Dashboard updates and opens
```

Without Twilio configured (or if a parent has no saved number), Sentinel runs a
**simulated call** through the same analysis pipeline, so the whole flow is
explorable with just an OpenAI key.

---

## Features

- **Dashboard** — overall wellbeing score, Nutrition / Voice / Hydration /
  Medication tiles, AI health signals, latest transcript, recent calls, and
  wellbeing trend charts.
- **AI health signals** — every signal carries a **confidence score**, the
  **supporting evidence** it was drawn from, and the **reason** it surfaced.
  Observations only — never a diagnosis.
- **Caregiver summary** — a natural-language recap generated after each call.
- **AI Chat** — ask questions across the call history ("Has Eleanor been eating
  enough this week?", "Has her speech changed?"), answered from stored
  conversations, trends and observations.
- **Trends** — wellbeing over 7 / 14 / 30 days and vocal biomarkers vs. baseline.
- **Nutrition intelligence** — structured nutrition signals, with a
  **MealRoaster** integration stub that turns them into meal suggestions.
- **Settings** — manage one or more parents and their phone numbers (stored on
  your device).

---

## Architecture

Next.js (App Router) with server **Route Handlers** wrapping two external
services. The guiding idea: **the model does perception and language; the app's
own deterministic code does the health logic** — so signals, scoring and
summaries stay consistent and defensible, and there are no hallucinated medical
claims.

- **OpenAI** powers analysis, chat and transcription. Each route returns a
  non-`2xx` when `OPENAI_API_KEY` is missing, and the client falls back to
  deterministic local logic. The dashboard labels each result **"Analysed by
  OpenAI"** or **"Offline analysis."**
- **Twilio Voice SDK** powers real in-app calling. The app user talks through the
  browser (WebRTC); Twilio dials only the parent, records the call, and a webhook
  hands the recording to OpenAI for transcription. Not configured → the client
  falls back to the simulated call.
- **State** — conversations live in React state; parent contacts live in
  `localStorage`; the server-side call bridge uses a small in-memory store keyed
  by Twilio `CallSid`.

---

## Project structure

```
app/
├── layout.tsx              Root layout + metadata
├── page.tsx                The entire client UI (dashboard, call modal, chat, settings)
├── globals.css             Base styles
├── additions.css           Component styles
├── lib/
│   ├── sentinel.ts         Domain model + analysis engine: types, seed history,
│   │                       signal/score/summary generation, AI-chat fallback,
│   │                       MealRoaster stub, and client fetch helpers
│   ├── openai.ts           OpenAI client + model config (chat & transcription)
│   ├── twilio.ts           Twilio config + Voice access-token minting
│   ├── voiceCall.ts        Browser Voice SDK controller (dynamically imported)
│   ├── callStore.ts        In-memory call store (globalThis-backed), keyed by CallSid
│   └── parents.ts          localStorage CRUD for parent contacts
└── api/
    ├── analyze/            POST — transcript → structured extraction (JSON mode)
    ├── chat/               POST — question + history → grounded answer
    ├── transcribe/         POST — audio blob → OpenAI speech-to-text
    ├── token/              GET  — Twilio Voice access token
    └── call/
        ├── voice/          POST — TwiML: dials the parent and records the call
        ├── recording/      POST — Twilio webhook → download + transcribe recording
        └── status/         GET  — poll a call's result by callSid
```

---

## API routes

| Route | Method | Purpose | Fallback when unconfigured |
| --- | --- | --- | --- |
| `/api/analyze` | POST | Transcript → `{ nutrition, medication, hydration, vocal }` via OpenAI JSON mode | `501` → client uses deterministic extraction |
| `/api/chat` | POST | Question + compacted history → grounded natural-language answer | `501` → client uses rule-based answer |
| `/api/transcribe` | POST | Audio blob (multipart `audio`) → transcript text | `501` |
| `/api/token` | GET | Twilio Voice access token for the browser SDK | `501` → simulated call |
| `/api/call/voice` | POST | TwiML that dials the parent and records the call | — |
| `/api/call/recording` | POST | Twilio recording webhook → download + OpenAI transcription → store | — |
| `/api/call/status` | GET | Poll a placed call's transcription result by `callSid` | — |

---

## The `Conversation` data model

Every completed call is stored as one typed record (see `app/lib/sentinel.ts`) —
the single source the dashboard, trends and AI chat all read from. It's shaped so
nutrition can later feed MealRoaster without rework.

```ts
interface Conversation {
  id, date, label, durationMin          // identity
  transcript:  TranscriptLine[]         // what was said
  nutrition:   NutritionExtraction      // meals, appetite, protein, skipped meals…
  medication:  MedicationExtraction     // confirmed, missed, timing, supplements
  hydration:   { glasses, target, note }
  vocal:       VocalBiomarkers          // 8 measures, as % of baseline
  signals:     HealthSignal[]           // each: confidence + evidence + reason
  summary:     string                   // natural-language recap
  wellbeingScore: number                // 0–100
  riskLevel:   'Green' | 'Amber' | 'Red'
}
```

---

## Getting started

**Prerequisites:** Node.js 18.18+ (Node 20 LTS recommended).

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — copy the example and add your OpenAI key:
   ```bash
   cp .env.local.example .env.local
   ```
   Set `OPENAI_API_KEY`. (Without it, the app still runs and uses the offline
   fallback for analysis and chat.)

3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

> **Tip:** don't run `npm run build` while `npm run dev` is running — they share
> the `.next` folder and it can corrupt the dev server. Stop dev first, or use
> `npx tsc --noEmit` to type-check.

---

## Environment variables

Copy `.env.local.example` → `.env.local`. `.env.local` is git-ignored.

**OpenAI**

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes (for real AI) | — | Enables analysis, chat, transcription |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Chat & analysis model |
| `OPENAI_TRANSCRIBE_MODEL` | No | `gpt-4o-mini-transcribe` | Speech-to-text model (`whisper-1` also works) |

**Twilio** (optional — enables real calls; leave unset for simulated calls)

| Variable | Notes |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | From the Twilio console |
| `TWILIO_AUTH_TOKEN` | Used to download the recording |
| `TWILIO_PHONE_NUMBER` | Your Twilio number (caller ID shown to the parent) |
| `TWILIO_API_KEY_SID` | API key (Standard) for minting Voice tokens |
| `TWILIO_API_KEY_SECRET` | API key secret |
| `TWILIO_TWIML_APP_SID` | TwiML App whose Voice URL is `{PUBLIC_BASE_URL}/api/call/voice` |
| `PUBLIC_BASE_URL` | Public https origin for webhooks (e.g. an ngrok URL) |

Parent phone numbers are **not** environment variables — they're added in the
app's **Settings** and stored in `localStorage`.

---

## Real calls (Twilio)

By default Sentinel runs a **simulated** call so the full experience works with
just an OpenAI key. To place a **real** call — where you talk through the app and
Twilio dials the parent, records, and transcribes — follow the step-by-step guide
in **[TWILIO_SETUP.md](./TWILIO_SETUP.md)** (create an API Key + a TwiML App,
expose your server with ngrok, fill in the Twilio env vars, add a parent number
in Settings, and allow microphone access).

> Microphone access requires a secure context, so real calling works over
> `localhost` or https (ngrok) — not a plain LAN IP.

---

## Design principles

- **Never automatic.** A family member always initiates the call; Sentinel only
  listens and analyses afterwards.
- **Observations, not diagnoses.** Every signal is framed against the parent's own
  baseline and carries confidence, evidence and a reason.
- **The demo never breaks.** Missing keys, no Twilio, or a flaky network all fall
  back to deterministic local logic; the UI always labels which path ran.
- **Privacy-minded.** Parent numbers stay on the device; conversations are
  analysed and shown only to the person using the app.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run Next.js ESLint |

---

## Status & roadmap

**Working today:** the full call → analysis → dashboard flow; real OpenAI-powered
analysis, chat and transcription with deterministic fallback; browser calling via
the Twilio Voice SDK (add your Twilio keys to enable); multi-parent management in
Settings.

**Next:** persist conversations to a database (they currently live in app state);
per-parent dashboards and history; wire the MealRoaster stub to a real service;
optional live/streaming transcription.

---

## Disclaimer

Sentinel is for **wellbeing awareness only**. It never calls on its own and never
replaces hearing a loved one's voice. It does **not** provide medical advice,
diagnosis, or treatment — signals are observations compared with a person's own
baseline, not clinical findings. Recording calls is regulated; obtain consent
(the call plays a spoken recording notice).
