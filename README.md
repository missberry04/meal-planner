# Weekly Meal Plan

An AI-generated weekly meal planner. Set a budget, calorie goal, dietary
restrictions, and medical conditions (all optional) — it generates a
day-by-day plan with full recipes.

Runs entirely on free tiers: GitHub + Vercel (Hobby) + Groq (free API).

## 1. Get a free Groq API key

Go to https://console.groq.com, sign up (no credit card), and create an API
key.

## 2. Run it locally

```bash
npm install
npm i -g vercel   # once, if you don't have it
vercel dev
```

`vercel dev` serves both the React app and the `/api/generate-plan` function
together, which is what you want since plain `vite` alone won't run the
serverless function. When it starts, it'll ask you to link/create a Vercel
project — just follow the prompts.

Create a `.env` file (copy `.env.example`) with your real key:

```
GROQ_API_KEY=gsk_your_real_key_here
```

## 3. Deploy for free

```bash
git init
git add .
git commit -m "meal planner"
```

Push to a new GitHub repo, then:

1. Go to vercel.com → **Add New Project** → import the repo
2. Vercel auto-detects Vite (build: `npm run build`, output: `dist`) — leave defaults
3. Before deploying, add an environment variable:
   - Key: `GROQ_API_KEY`
   - Value: your Groq key
4. Deploy

Every future `git push` auto-redeploys. Your key stays server-side the whole
time — it's never sent to the browser.

## Notes

- The app calls the AI once per day (not once for the whole week) so each
  response stays small and reliable. You'll see days fill in one at a time.
- If a day fails to generate, there's a retry button for just that day.
- This is general meal guidance, not medical advice — the "medical
  conditions" field nudges recipe choices (e.g. lower sodium for high blood
  pressure) but isn't a substitute for a doctor or dietitian.
