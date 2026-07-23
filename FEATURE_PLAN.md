# League Hub — Feature Plan

A phased roadmap. Each phase should leave you with something runnable — don't
move on until you can see it working locally.

---

## Phase 0 — Environment setup
- [ ] Create a free Postgres instance (Supabase or Neon)
- [ ] `npm install`
- [ ] Fill in `.env` from `.env.example`
- [ ] `npx prisma migrate dev --name init`
- [ ] Confirm `npx prisma studio` opens and shows empty tables

## Phase 1 — Sleeper sync
- [ ] Find your league ID (in the Sleeper app: League → Settings, or the URL)
- [ ] Run `npm run sync` and confirm rows appear in `League`, `Manager`, `Matchup` via Prisma Studio
- [ ] Sanity-check a couple of matchup rows against the Sleeper app — points and opponent should match
- [ ] Handle the "season hasn't started" case gracefully (sync should no-op, not crash)
- [ ] Decide how you want `teamName` populated — Sleeper's user API gives `display_name` (Sleeper username) but not always a custom team name; you may need `/league/{id}/rosters` metadata or just default to display name for now

## Phase 2 — Basic pages (no bonuses yet)
- [ ] Standings page: query `Matchup` grouped by manager, sum points, compute wins/losses from points comparisons, sort by record
- [ ] Team page: one manager's week-by-week scores
- [ ] Matchups page: this week's head-to-head pairings
- [ ] Wire up the Sidebar/TopNav components from the design system mockup as real Next.js components (`src/components/Sidebar.tsx`, `TopNav.tsx`) — pull them out of the static HTML and make them accept `activeTab` props

## Phase 3 — Bonus creation flow
- [ ] Build a simple form/modal: text input for the prompt, POST to `/api/bonuses`
- [ ] Wire up loading/error states — `generateBonusSpec` can fail (422) if Claude's output doesn't validate; show the error and let the commissioner retry with clearer wording
- [ ] After creation, redirect to a page showing the new bonus's first computed leaderboard
- [ ] **Test with your actual planned bonuses** — "highest regular season points," "highest single-game points," "biggest blowout" — and inspect the generated `dslJson` in Prisma Studio to sanity-check it before trusting it

## Phase 4 — Bonus DSL coverage
The starter schema in `bonusSchema.ts` covers points/margin-based bonuses.
Expand it as you think of new bonus ideas. Some you'll likely want soon:
- [ ] "Best single-week margin over projection" — needs a `projectedPoints` field; Sleeper doesn't expose this directly, so this may require a third-party projections source or skipping it
- [ ] "Most points scored by a losing team" — needs a filter for `points < opponentPoints` combined with max(points); may need a new filter field
- [ ] "Longest winning streak" — needs sequential logic across weeks, which the current groupBy/aggregate shape doesn't support; this one may need a dedicated interpreter branch rather than the generic DSL
- [ ] Add new `field` enum values and filter fields to `bonusSchema.ts` as needed, and extend `bonusInterpreter.ts` to match — keep the interpreter's logic simple and auditable rather than trying to make the DSL fully general-purpose

## Phase 5 — Cron + deployment
- [ ] Deploy to Vercel, set all env vars there
- [ ] Confirm `vercel.json`'s cron fires (check the Vercel dashboard's Cron Jobs tab)
- [ ] Add a manual "Recompute now" button somewhere in the UI (calls `/api/bonuses/[id]/compute`) as a fallback if the cron is ever delayed
- [ ] Consider tightening the cron schedule around your league's actual game windows (e.g. run again Tuesday morning after MNF, not just once a day)

## Phase 6 — Polish
- [ ] Leader-change notifications: compare each day's new `BonusResult` to the previous one; if the #1 leader changed, post to a Discord webhook or similar
- [ ] Historical view: show a bonus's leaderboard-over-time using the full `BonusResult` history, not just the latest
- [ ] Avatar images: Sleeper's user API returns an avatar ID — build the image URL as `https://sleepercdn.com/avatars/{avatar_id}`
- [ ] Mobile responsiveness pass on the design system components
- [ ] Auth: if you want to let league members log in and toggle bonuses themselves rather than editing via API calls directly, add a lightweight auth layer (NextAuth) — likely lower priority for a private league tool

---

## Open decisions worth making early
- **Who can create/edit bonuses?** Commissioner-only (simplest) vs. any league member
- **Team names**: Sleeper usernames vs. custom team names — may need manual overrides stored in your own `Manager.teamName` field
- **Playoff handling**: confirm `playoff_week_start` from league settings correctly separates regular season from playoffs for your league's format
