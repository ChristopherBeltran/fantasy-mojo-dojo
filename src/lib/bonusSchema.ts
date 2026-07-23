import { z } from "zod";

/**
 * The declarative spec Claude generates when a bonus is created.
 * We NEVER eval() arbitrary code — the interpreter (bonusInterpreter.ts)
 * only understands this fixed shape, so it's safe to run against real data
 * regardless of what the AI returns (assuming it passes this schema).
 */

const FilterSchema = z.object({
  field: z.enum(["isPlayoff", "week"]),
  op: z.enum(["==", "!=", ">", ">=", "<", "<="]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const ComputeSchema = z.object({
  // name of the derived field, referenced by later steps
  as: z.string(),
  // only a small, fixed set of arithmetic expressions over row fields
  expr: z.enum(["points_minus_opponentPoints", "opponentPoints_minus_points"]),
});

export const BonusSpecSchema = z.object({
  label: z.string().min(1).max(80),
  source: z.literal("matchups"),
  filters: z.array(FilterSchema).default([]),
  compute: ComputeSchema.nullable().default(null),
  // group rows before aggregating (e.g. by manager, to sum a season total)
  groupBy: z.enum(["managerId"]).nullable().default(null),
  aggregate: z.object({
    type: z.enum(["sum", "max", "min", "avg"]),
    // which field to aggregate: a base field or a `compute.as` field
    field: z.enum(["points", "opponentPoints", "margin"]),
  }),
  // "max" = highest value wins (most points, biggest blowout)
  // "min" = lowest value wins (fewest points allowed, closest margin, etc.)
  rank: z.enum(["max", "min"]).default("max"),
  limit: z.number().int().min(1).max(50).default(10),
});

export type BonusSpec = z.infer<typeof BonusSpecSchema>;
