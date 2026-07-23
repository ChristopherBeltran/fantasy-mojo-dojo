# League Hub

Fantasy football league hub synced to Sleeper, with AI-defined, cron-computed season bonuses.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Postgres**
   Create a free Postgres instance ([Supabase](https://supabase.com) or [Neon](https://neon.tech) both work well) and copy the connection string.

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL`, `SLEEPER_LEAGUE_ID` (from your league's Sleeper URL), `ANTHROPIC_API_KEY`, and `CRON_SECRET` (any long random string).

4. **Push the schema to your database**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Run an initial sync**
   ```bash
   npm run sync
   ```

6. **Start the dev server**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000

## How the bonus system works

1. You POST a natural-language prompt to `/api/bonuses` (e.g. "award the highest regular season points").
2. That route calls Claude **once** to translate the prompt into a small JSON spec (see `src/lib/bonusSchema.ts` for the shape) and saves it to the `Bonus` table.
3. `src/lib/bonusInterpreter.ts` executes that spec against matchup rows already in Postgres — no AI involved, just filter/group/aggregate logic. This keeps computation fast and free of AI costs on every page load.
4. A daily cron (`/api/cron/daily-sync`, scheduled in `vercel.json`) re-syncs Sleeper data and reruns every active bonus's spec, saving a new `BonusResult` snapshot.
5. Pages just read the latest `BonusResult` row — instant loads, no live computation.

## Deploying

Deploy to [Vercel](https://vercel.com). Set the same environment variables there, and the cron job in `vercel.json` will run automatically (currently scheduled for 9am UTC daily — adjust to run after your league's game windows close).

## Project structure

```
prisma/schema.prisma          Data model (League, Manager, Matchup, Bonus, BonusResult)
src/lib/sleeper.ts             Sleeper API client
src/lib/claude.ts              One-time AI call: prompt -> DSL spec
src/lib/bonusSchema.ts         Zod schema validating the AI's DSL output
src/lib/bonusInterpreter.ts    Safely executes a validated spec (no eval)
src/app/api/sleeper/sync/      Pulls league/roster/matchup data from Sleeper
src/app/api/bonuses/           Create bonuses (AI call) + list bonuses
src/app/api/bonuses/[id]/compute/  Recompute one bonus's leaderboard (no AI)
src/app/api/cron/daily-sync/   Daily job: sync + recompute all bonuses
src/components/BonusCard.tsx   Leaderboard card UI
```

See `FEATURE_PLAN.md` for the implementation roadmap.
