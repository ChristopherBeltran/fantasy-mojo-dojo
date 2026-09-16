# League Hub — Feature Plan

A phased roadmap. Each phase should leave you with something runnable — don't
move on until you can see it working locally.

---

## Phase 0 — Environment setup
- [x] Create a free Postgres instance (Supabase or Neon)
- [x] `npm install`
- [x] Fill in `.env` from `.env.example`
- [x] `npx prisma migrate dev --name init`
- [x] Confirm `npx prisma studio` opens and shows empty tables

## Phase 1 — Sleeper sync
- [x] Find your league ID (in the Sleeper app: League → Settings, or the URL)
- [x] Run `npm run sync` and confirm rows appear in `League`, `Manager`, `Matchup` via Prisma Studio
- [x] Sanity-check a couple of matchup rows against the Sleeper app — points and opponent should match
- [x] Handle the "season hasn't started" case gracefully (sync should no-op, not crash)
- [x] Decide how you want `teamName` populated — pulled from `metadata.team_name` on the users endpoint, falling back to `null` (UI falls back to `displayName`) when a manager hasn't set a custom team name

## Phase 2 — Basic pages (no bonuses yet)
- [x] Standings page: query `Matchup` grouped by manager, sum points, compute wins/losses from points comparisons, sort by record (regular season only; `/standings`)
- [x] Team page: one manager's week-by-week scores (`/team/[managerId]`)
- [x] Matchups page: this week's head-to-head pairings (`/matchups`)
- [x] Wire up the Sidebar/TopNav components from the design system mockup as real Next.js components (`src/components/Sidebar.tsx`, `TopNav.tsx`) — trimmed to the pages that actually exist (Home, Standings, Matchups); the mockup's Media/Draft/Mini-Games/Wrapped/Research/Stats/multi-league nav wasn't ported since none of it is in this plan

## Phase 3 — Bonus creation flow
- [x] Build a simple form/modal: text input for the prompt, POST to `/api/bonuses` (`AddBonusModal`, triggered from Home — visible to all, but the POST itself requires the commissioner Basic Auth from the earlier gate)
- [x] Wire up loading/error states — `generateBonusSpec` can fail (422) if Claude's output doesn't validate; show the error and let the commissioner retry with clearer wording
- [x] After creation, redirect to a page showing the new bonus's first computed leaderboard (`/bonuses/[id]`)
- [x] **Test with your actual planned bonuses** — "highest regular season points," "highest single-game points," "biggest blowout" — all three exist with Claude-generated `dslJson` that matches the intended filter/groupBy/aggregate shape (verified against `bonusSchema.ts`/`bonusInterpreter.ts`), each with a computed `BonusResult` and rendering correctly on Home and `/bonuses/[id]`. Leaderboards are currently empty since no matchups are synced yet (2026 season hasn't started) — confirmed that renders cleanly with no crash rather than actual per-manager values

## Phase 4 — Bonus DSL coverage
The starter schema in `bonusSchema.ts` covers points/margin-based bonuses.
Expand it as you think of new bonus ideas.
- ~~"Best single-week margin over projection"~~ — not tracking this one
- ~~"Most points scored by a losing team"~~ — not tracking this one
- ~~"Longest winning streak"~~ — not tracking this one
- [ ] Add new `field` enum values and filter fields to `bonusSchema.ts` as needed, and extend `bonusInterpreter.ts` to match, once there's an actual bonus idea that needs them — keep the interpreter's logic simple and auditable rather than trying to make the DSL fully general-purpose

## Phase 5 — Cron + deployment
- [ ] Deploy to Vercel, set all env vars there — project `fantasy-mojo-dojo` is created and linked (`christopherbeltrans-projects`), and `DATABASE_URL`/`SLEEPER_LEAGUE_ID`/`COMMISSIONER_USER`/`COMMISSIONER_PASSWORD` are set in Production. Still needed: `ANTHROPIC_API_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN` (blank locally, so not pushed — add for real in the Vercel dashboard), reconnect the GitHub repo under Project → Settings → Git (the CLI's auto-connect failed), then `vercel --prod`
- [ ] Confirm `vercel.json`'s cron fires (check the Vercel dashboard's Cron Jobs tab) — blocked on the deploy above
- [x] Add a manual "Recompute now" button somewhere in the UI (calls `/api/bonuses/[id]/compute`) as a fallback if the cron is ever delayed — added to `BonusCard` (`RecomputeButton`), so it shows on both Home and `/bonuses/[id]`; visible to everyone like `AddBonusModal`, but the POST itself is already commissioner-gated by middleware
- [x] Consider tightening the cron schedule around your league's actual game windows (e.g. run again Tuesday morning after MNF, not just once a day) — the existing daily `0 9 * * *` (≈4-5am ET) already runs after every game night including MNF, so added a second `0 14 * * 2` (Tuesday, later morning) run to catch any Monday Night Football stat corrections Sleeper publishes after the early run

## Phase 6 — Polish
- [ ] Leader-change notifications: compare each day's new `BonusResult` to the previous one; if the #1 leader changed, post to a Discord webhook or similar
- [ ] Historical view: show a bonus's leaderboard-over-time using the full `BonusResult` history, not just the latest
- [ ] Avatar images: Sleeper's user API returns an avatar ID — build the image URL as `https://sleepercdn.com/avatars/{avatar_id}`
- [ ] Mobile responsiveness pass on the design system components
- [ ] Auth: if you want to let league members log in and toggle bonuses themselves rather than editing via API calls directly, add a lightweight auth layer (NextAuth) — likely lower priority for a private league tool

## Phase 7 — AI matchup posters
Commissioner-only feature: generate a stylized "matchup poster" per head-to-head
pairing each week, using reference photos uploaded for each manager.
- [x] `ManagerPhoto` (up to 3 per manager, oldest-first) + `MatchupPoster` schema (canonical `managerAId < managerBId` pair per league/week) — originally a single `Manager.photoUrl`, migrated to a one-to-many `ManagerPhoto` table so posters can draw on multiple reference angles per manager
- [x] `/commissioner/photos` — commissioner-only page (gated on every method, not just writes) to upload/delete each manager's reference photos (capped at 3; upload is rejected once at the cap rather than silently dropping an old one)
- [x] `src/lib/posterGen.ts` — calls Gemini 2.5 Flash Image with *all* of both managers' reference photos (grouped per-manager with text labels so the model doesn't conflate whose photo is whose), stylized/cartoon prompt (not photorealistic — more forgiving of imperfect likeness, less content-policy friction than a photoreal composite), uploads the result to Vercel Blob
- [x] Wired into the daily cron, after sync + bonus recompute — idempotent (skips pairs that already have a poster, or where either manager has zero photos), which is what makes "run once the new week begins" work: the first cron run after a new week appears is the only one that actually generates anything for it
- [x] Posters display above each pairing on `/matchups`
- [x] Set `GEMINI_API_KEY` and `BLOB_READ_WRITE_TOKEN` in Vercel (Production and Preview) — done as part of Phase 5's deploy work
- [ ] Smoke-test real generation against the live Gemini API — the SDK call is implemented against `@google/genai`'s actual shipped type definitions, but hasn't produced real output yet
- [ ] Upload reference photos for each manager in `/commissioner/photos` — posters only generate for pairs where both managers have at least one
- [x] First real generation attempt surfaced two issues, both fixed: both characters looked like the same person (added an explicit "these are two different people, don't blend them" instruction), and output came out as a too-tall 974x1863 sliver (set `imageConfig.aspectRatio: "3:4"`) — still not verified against a live call since the Gemini billing/quota issue remains open
- [x] Commissioner-only "Regenerate poster" button per pairing on `/matchups`, plus a `/commissioner/settings` page to edit the prompt itself (stored in a new generic `Setting` table, no deploy needed to tweak wording) with a "regenerate all this week's posters" follow-up after saving

## Phase 8 — Last Man Standing
Elimination pool running weeks 3-14: each week the surviving manager with the
lowest score that week is out, until one manager remains.
- [x] `LastManStandingElimination` schema (one row per elimination, unique per league/season/week/manager) + `src/lib/lastManStanding.ts`'s `computeLastManStanding` — idempotent, catches up every unprocessed week in range so a missed cron doesn't leave a gap; ties for lowest broken by lowest cumulative regular-season points through that week; stops eliminating once one manager remains (winner)
- [x] `/last-man-standing` page + nav item (💪) — leaderboard table with Sleeper avatar as team logo, Status (Alive/Eliminated) and Eliminated (week) columns, eliminated rows dimmed/struck-through
- [x] `/api/cron/last-man-standing` — separate weekly cron (`0 14 * * 2`, same Tuesday-morning slot as the daily-sync MNF-correction run; syncs Sleeper itself first rather than assuming ordering with that other cron) + manual `RecomputeButton`-style fallback on the page, commissioner-gated like the rest of `/api/*` writes
- [ ] **Confirm the 3rd cron entry in `vercel.json` actually deploys** — Vercel's plan tier may cap total cron jobs per project; if this one is rejected, fold the elimination check into the existing daily-sync route instead
- [ ] Watch the first couple of real weekly runs once the season reaches week 3, to confirm the tiebreak and winner-stop logic behave as expected against real (not smoke-tested) data

---

## Open decisions worth making early
- **Who can create/edit bonuses?** Commissioner-only (simplest) vs. any league member
- **Team names**: Sleeper usernames vs. custom team names — may need manual overrides stored in your own `Manager.teamName` field
- **Playoff handling**: confirm `playoff_week_start` from league settings correctly separates regular season from playoffs for your league's format
