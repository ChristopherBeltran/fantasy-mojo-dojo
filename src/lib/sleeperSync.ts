import { prisma } from "@/lib/prisma";
import {
  getLeague,
  getUsers,
  getRosters,
  getMatchupsForWeek,
  getNflState,
  pairMatchups,
  MAX_REGULAR_SEASON_WEEK,
} from "@/lib/sleeper";

/**
 * Pulls the latest league/roster/matchup data from Sleeper and upserts it
 * into Postgres. Safe to call repeatedly — everything is keyed so re-runs
 * just update existing rows instead of duplicating them.
 */
export async function syncLeague(sleeperLeagueId: string) {
  const [sleeperLeague, users, rosters, nflState] = await Promise.all([
    getLeague(sleeperLeagueId),
    getUsers(sleeperLeagueId),
    getRosters(sleeperLeagueId),
    getNflState(),
  ]);

  const league = await prisma.league.upsert({
    where: { sleeperLeagueId },
    update: {
      name: sleeperLeague.name,
      season: sleeperLeague.season,
      totalRosters: sleeperLeague.total_rosters,
      settingsJson: sleeperLeague.settings as object,
      lastSyncedAt: new Date(),
    },
    create: {
      sleeperLeagueId,
      name: sleeperLeague.name,
      season: sleeperLeague.season,
      totalRosters: sleeperLeague.total_rosters,
      settingsJson: sleeperLeague.settings as object,
      lastSyncedAt: new Date(),
    },
  });

  const usersById = new Map(users.map((u) => [u.user_id, u]));

  const managerByRosterId = new Map<number, string>(); // rosterId -> Manager.id
  for (const roster of rosters) {
    const user = usersById.get(roster.owner_id);
    const manager = await prisma.manager.upsert({
      where: {
        leagueId_rosterId: { leagueId: league.id, rosterId: roster.roster_id },
      },
      update: {
        displayName: user?.display_name ?? `Roster ${roster.roster_id}`,
        teamName: user?.metadata?.team_name || null,
        avatarUrl: user?.avatar ?? null,
      },
      create: {
        leagueId: league.id,
        sleeperUserId: roster.owner_id,
        rosterId: roster.roster_id,
        displayName: user?.display_name ?? `Roster ${roster.roster_id}`,
        teamName: user?.metadata?.team_name || null,
        avatarUrl: user?.avatar ?? null,
      },
    });
    managerByRosterId.set(roster.roster_id, manager.id);
  }

  const playoffWeekStart =
    (sleeperLeague.settings?.playoff_week_start as number | undefined) ??
    MAX_REGULAR_SEASON_WEEK + 1;

  // Sleeper pre-populates matchup pairings for every week as soon as the
  // season schedule exists, with points: 0 until that week is actually
  // played — /league/{id}/matchups/{week} is never empty, even for weeks
  // far in the future. So we bound the loop to Sleeper's own notion of the
  // current week (getNflState) rather than relying on an empty response to
  // stop us, which never happens.
  const lastWeekToSync = Math.min(MAX_REGULAR_SEASON_WEEK, nflState.week);

  let weeksSynced = 0;
  for (let week = 1; week <= lastWeekToSync; week++) {
    const rawMatchups = await getMatchupsForWeek(sleeperLeagueId, week);
    if (rawMatchups.length === 0) break; // defense in depth, shouldn't normally trigger

    const pairs = pairMatchups(rawMatchups);
    const isPlayoff = week >= playoffWeekStart;

    for (const { home, away } of pairs) {
      const homeManagerId = managerByRosterId.get(home.roster_id);
      const awayManagerId = managerByRosterId.get(away.roster_id);
      if (!homeManagerId || !awayManagerId) continue;

      // Store both directions so every team's row has their own points +
      // the opponent's points — simplifies every bonus computation later.
      await prisma.matchup.upsert({
        where: {
          leagueId_week_managerId: {
            leagueId: league.id,
            week,
            managerId: homeManagerId,
          },
        },
        update: {
          points: home.points,
          opponentId: awayManagerId,
          opponentPoints: away.points,
          isPlayoff,
        },
        create: {
          leagueId: league.id,
          week,
          season: sleeperLeague.season,
          isPlayoff,
          managerId: homeManagerId,
          points: home.points,
          opponentId: awayManagerId,
          opponentPoints: away.points,
        },
      });

      await prisma.matchup.upsert({
        where: {
          leagueId_week_managerId: {
            leagueId: league.id,
            week,
            managerId: awayManagerId,
          },
        },
        update: {
          points: away.points,
          opponentId: homeManagerId,
          opponentPoints: home.points,
          isPlayoff,
        },
        create: {
          leagueId: league.id,
          week,
          season: sleeperLeague.season,
          isPlayoff,
          managerId: awayManagerId,
          points: away.points,
          opponentId: homeManagerId,
          opponentPoints: home.points,
        },
      });
    }
    weeksSynced = week;
  }

  return { league, weeksSynced };
}
