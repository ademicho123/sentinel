# Sentinel

Sentinel is an AI-assisted dashboard for family wellbeing. It transcribes calls via Twilio and uses OpenAI to analyze conversation details (nutrition, hydration, medication) and vocal patterns.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.local.example` to `.env.local` and add your `OPENAI_API_KEY`.

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Twilio Integration (Optional)

To configure real calls instead of simulation, please follow the instructions in [TWILIO_SETUP.md](file:///c:/Users/ELITEBOOK/Desktop/projects/sentinel/TWILIO_SETUP.md).
