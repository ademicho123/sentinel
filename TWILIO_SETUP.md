# Real calls (Twilio browser calling + OpenAI transcription)

Sentinel can place a **real** call to a parent's phone while **you talk through the
app** (no phone needed for you). The call is recorded and transcribed with OpenAI.
Without Twilio configured, "Call Parent" runs a built-in **simulated** call so the
app still works — so this setup is optional.

## How it works

1. You add parent phone numbers in **Settings** (stored on your device — not env).
   More than one parent can be added.
2. You tap **Call Parent**, pick who to call → the browser gets a Voice token from
   `GET /api/token` and connects via the Twilio Voice SDK (your mic + speakers).
3. Twilio hits the TwiML App's Voice URL `POST /api/call/voice`, which dials the
   parent (`<Dial record="record-from-answer-dual">`) and records the call.
4. You talk to the parent; press **End** when done.
5. Twilio calls `POST /api/call/recording` with the recording URL. Sentinel
   downloads it and transcribes it with OpenAI.
6. The browser polls `GET /api/call/status?callSid=…`; when the transcript is
   ready it runs the normal analysis and updates the dashboard.

There is **no caregiver phone number** — the person using the app is just someone
checking on their parent, and their audio runs through the browser.

## One-time setup

1. **Twilio account** → from the console grab your **Account SID** and
   **Auth Token**, and buy a **voice-capable phone number** (the caller ID).
   - On a **trial** account you can only call **verified** numbers, so verify each
     parent number under *Phone Numbers → Verified Caller IDs*.
2. **Create an API Key** (for minting browser Voice tokens):
   *Account → API keys & tokens → Create API key (Standard)* → save the
   **SID** and **Secret**.
3. **Expose your local server** so Twilio can reach the webhooks:
   ```bash
   ngrok http 3000
   ```
   Copy the `https://….ngrok-free.app` URL.
4. **Create a TwiML App**: *Voice → TwiML → TwiML Apps → Create*. Set its
   **Voice Request URL** to `{PUBLIC_BASE_URL}/api/call/voice` (HTTP **POST**).
   Save its **SID**.
5. **Fill in `.env.local`** (see `.env.local.example`):
   ```
   OPENAI_API_KEY=sk-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...        # your Twilio number (caller ID)
   TWILIO_API_KEY_SID=SK...
   TWILIO_API_KEY_SECRET=...
   TWILIO_TWIML_APP_SID=AP...
   PUBLIC_BASE_URL=https://XXXX.ngrok-free.app   # no trailing slash
   ```
6. Restart `npm run dev`, open the app over **https/localhost** (mic needs a secure
   context), add a parent number in **Settings**, then press **Call Parent** and
   allow microphone access.

## Notes & limits

- Parent numbers are **E.164** (`+countrycode…`) and managed in Settings
  (localStorage) — never in env.
- The in-memory call store (`app/lib/callStore.ts`) lives in one Node process —
  fine for a single-instance demo; use Redis/DB behind multiple instances.
- OpenAI transcription returns plain text (no speaker labels), so the whole call
  is stored as one transcript line. Speaker diarization would need per-leg
  recording or a diarizing STT provider.
- Recording people is regulated — get consent. The TwiML plays a spoken notice
  that the call is recorded.
- Whichever parent has no saved number falls back to a simulated call.
