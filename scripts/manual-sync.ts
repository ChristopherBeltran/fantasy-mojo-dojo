/**
 * Run with: npm run sync
 * Useful for testing the Sleeper sync locally without deploying the cron.
 */
import { syncLeague } from "../src/app/api/sleeper/sync/route";

async function main() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) throw new Error("Set SLEEPER_LEAGUE_ID in your .env file first");

  console.log(`Syncing league ${leagueId}...`);
  const { weeksSynced } = await syncLeague(leagueId);
  console.log(`Done. Synced ${weeksSynced} weeks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
