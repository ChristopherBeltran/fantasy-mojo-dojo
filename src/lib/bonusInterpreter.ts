import type { BonusSpec } from "./bonusSchema";

/**
 * Flat shape the interpreter operates on. Map your Prisma Matchup rows
 * (joined with Manager) into this before calling runBonusSpec.
 */
export interface MatchupRow {
  managerId: string;
  displayName: string;
  week: number;
  isPlayoff: boolean;
  points: number;
  opponentPoints: number | null;
}

export interface LeaderboardEntry {
  managerId: string;
  displayName: string;
  value: number;
  week: number | null; // set for per-game bonuses, null for season-long, useful for display
}

function passesFilter(row: MatchupRow, filter: BonusSpec["filters"][number]): boolean {
  const actual = row[filter.field as "week" | "isPlayoff"];
  const { op, value } = filter;
  switch (op) {
    case "==":
      return actual === value;
    case "!=":
      return actual !== value;
    case ">":
      return (actual as number) > (value as number);
    case ">=":
      return (actual as number) >= (value as number);
    case "<":
      return (actual as number) < (value as number);
    case "<=":
      return (actual as number) <= (value as number);
  }
}

function applyCompute(row: MatchupRow, compute: BonusSpec["compute"]): number | null {
  if (!compute) return null;
  if (row.opponentPoints == null) return null;
  switch (compute.expr) {
    case "points_minus_opponentPoints":
      return row.points - row.opponentPoints;
    case "opponentPoints_minus_points":
      return row.opponentPoints - row.points;
  }
}

function fieldValue(row: MatchupRow, margin: number | null, field: BonusSpec["aggregate"]["field"]): number {
  if (field === "margin") return margin ?? 0;
  if (field === "points") return row.points;
  if (field === "opponentPoints") return row.opponentPoints ?? 0;
  return 0;
}

/**
 * Runs a validated BonusSpec against a set of matchup rows and returns a
 * ranked leaderboard. This function only ever performs filter/compute/
 * groupBy/aggregate operations defined by the schema — it never executes
 * code supplied by the AI or the user.
 */
export function runBonusSpec(spec: BonusSpec, rows: MatchupRow[]): LeaderboardEntry[] {
  const filtered = rows.filter((row) => spec.filters.every((f) => passesFilter(row, f)));

  const withMargin = filtered.map((row) => ({
    row,
    margin: applyCompute(row, spec.compute),
  }));

  if (!spec.groupBy) {
    // Per-game bonus (e.g. "highest single-game points", "biggest blowout")
    const entries: LeaderboardEntry[] = withMargin.map(({ row, margin }) => ({
      managerId: row.managerId,
      displayName: row.displayName,
      value: fieldValue(row, margin, spec.aggregate.field),
      week: row.week,
    }));
    entries.sort((a, b) => (spec.rank === "max" ? b.value - a.value : a.value - b.value));
    return entries.slice(0, spec.limit);
  }

  // Season-long bonus (e.g. "highest regular season points")
  const groups = new Map<string, { displayName: string; values: number[] }>();
  for (const { row, margin } of withMargin) {
    const key = row.managerId;
    const group = groups.get(key) ?? { displayName: row.displayName, values: [] };
    group.values.push(fieldValue(row, margin, spec.aggregate.field));
    groups.set(key, group);
  }

  const entries: LeaderboardEntry[] = Array.from(groups.entries()).map(([managerId, group]) => {
    let value: number;
    switch (spec.aggregate.type) {
      case "sum":
        value = group.values.reduce((a, b) => a + b, 0);
        break;
      case "max":
        value = Math.max(...group.values);
        break;
      case "min":
        value = Math.min(...group.values);
        break;
      case "avg":
        value = group.values.reduce((a, b) => a + b, 0) / group.values.length;
        break;
    }
    return { managerId, displayName: group.displayName, value, week: null };
  });

  entries.sort((a, b) => (spec.rank === "max" ? b.value - a.value : a.value - b.value));
  return entries.slice(0, spec.limit);
}
