/**
 * Thin client for the public, unauthenticated Sleeper API.
 * Docs: https://docs.sleeper.com/
 */

const BASE = "https://api.sleeper.app/v1";

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  settings: Record<string, unknown>;
  status: string; // "in_season" | "complete" | ...
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null; // teams sharing a matchup_id played each other that week
  points: number;
}

async function sleeperGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // Sleeper data for past weeks never changes; cache aggressively.
    // Current week's data changes live on game day — the cron controls how often we re-fetch.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Sleeper API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getLeague(leagueId: string) {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`);
}

export function getUsers(leagueId: string) {
  return sleeperGet<SleeperUser[]>(`/league/${leagueId}/users`);
}

export function getRosters(leagueId: string) {
  return sleeperGet<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export function getMatchupsForWeek(leagueId: string, week: number) {
  return sleeperGet<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
}

/**
 * Pairs up Sleeper's flat matchup rows (one per roster) into home/away pairs
 * using the shared matchup_id, and derives points-allowed for each side.
 */
export function pairMatchups(rows: SleeperMatchup[]) {
  const byMatchupId = new Map<number, SleeperMatchup[]>();
  for (const row of rows) {
    if (row.matchup_id == null) continue; // bye week
    const group = byMatchupId.get(row.matchup_id) ?? [];
    group.push(row);
    byMatchupId.set(row.matchup_id, group);
  }

  const pairs: { home: SleeperMatchup; away: SleeperMatchup }[] = [];
  for (const group of byMatchupId.values()) {
    if (group.length === 2) {
      pairs.push({ home: group[0], away: group[1] });
    }
  }
  return pairs;
}

/**
 * NFL regular season currently runs weeks 1-17 (through 18 in some formats).
 * Adjust MAX_WEEK if your league's settings differ (playoffs, bye weeks, etc).
 * A safer long-term approach: read `league.settings.playoff_week_start` from
 * getLeague() and treat weeks >= that value as playoff weeks.
 */
export const MAX_REGULAR_SEASON_WEEK = 18;
