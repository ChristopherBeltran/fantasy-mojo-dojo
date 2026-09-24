import { RecomputeButton } from "./RecomputeButton";
import { TeamAvatar } from "./TeamAvatar";

interface LeaderboardEntry {
  managerId: string;
  displayName: string;
  value: number;
}

interface BonusCardProps {
  bonusId: string;
  label: string;
  computedAt: string; // ISO date string
  leaderboard: LeaderboardEntry[];
  // Manager.id -> Sleeper avatar id. Stored leaderboards only snapshot
  // managerId/displayName, so avatars are looked up by the caller.
  avatarsByManagerId?: Record<string, string | null>;
  valueFormatter?: (value: number) => string;
}

const defaultFormatter = (value: number) => value.toFixed(1);

export function BonusCard({
  bonusId,
  label,
  computedAt,
  leaderboard,
  avatarsByManagerId = {},
  valueFormatter = defaultFormatter,
}: BonusCardProps) {
  const computedDate = new Date(computedAt);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-faint uppercase mb-1">
            Bonus
          </p>
          <h2 className="font-bold text-lg">{label}</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full border border-brandTeal/30 bg-brandTeal/10 text-brandTeal text-[10px] font-bold uppercase">
          Live
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-[11px] uppercase tracking-wide">
              <th className="px-3 md:px-5 py-2 font-semibold">Rank</th>
              <th className="px-3 md:px-5 py-2 font-semibold">Team</th>
              <th className="px-3 md:px-5 py-2 font-semibold text-right">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, i) => (
              <tr
                key={entry.managerId}
                className={`border-t border-border ${i === 0 ? "bg-brandTeal/5" : ""}`}
              >
                <td
                  className={`px-3 md:px-5 py-3 font-bold ${i === 0 ? "text-brandTeal" : "text-muted"}`}
                >
                  {i + 1}
                </td>
                <td
                  className={`px-3 md:px-5 py-3 ${i === 0 ? "font-semibold" : ""}`}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <TeamAvatar
                      avatarId={avatarsByManagerId[entry.managerId]}
                    />
                    {entry.displayName}
                  </div>
                </td>
                <td
                  className={`px-3 md:px-5 py-3 text-right tabular ${i === 0 ? "font-bold text-brandTeal" : "text-slate-300"}`}
                >
                  {valueFormatter(entry.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border text-[11px] text-faint">
        <span>
          Last computed {computedDate.toLocaleString()} · Recomputes daily after
          games are played
        </span>
        <RecomputeButton bonusId={bonusId} />
      </div>
    </div>
  );
}
