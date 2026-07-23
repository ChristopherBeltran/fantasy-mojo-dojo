import Anthropic from "@anthropic-ai/sdk";
import { BonusSpecSchema, type BonusSpec } from "./bonusSchema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You convert a fantasy football commissioner's plain-English bonus/award description into a strict JSON spec.

Respond with ONLY a JSON object — no prose, no markdown fences.

The JSON must match this shape exactly:
{
  "label": string,                          // short display name for the award
  "source": "matchups",                     // always this literal value
  "filters": [                              // 0 or more; use to scope regular season vs playoffs
    { "field": "isPlayoff" | "week", "op": "==" | "!=" | ">" | ">=" | "<" | "<=", "value": boolean | number }
  ],
  "compute": null | { "as": string, "expr": "points_minus_opponentPoints" | "opponentPoints_minus_points" },
  "groupBy": null | "managerId",             // null = per-game award, "managerId" = season-long award
  "aggregate": { "type": "sum" | "max" | "min" | "avg", "field": "points" | "opponentPoints" | "margin" },
  "rank": "max" | "min",                     // "max" = highest value wins
  "limit": number                            // how many leaders to keep, default 10
}

Rules of thumb:
- "Highest regular season points" -> filters isPlayoff==false, groupBy managerId, aggregate sum of points, rank max
- "Highest points in a single game" -> filters isPlayoff==false, groupBy null, aggregate max of points, rank max
- "Biggest blowout" -> compute points_minus_opponentPoints as margin, aggregate max of margin, rank max, groupBy null
- "Fewest points allowed" -> aggregate on opponentPoints or margin with rank min, depending on phrasing
- Only include a "week" filter if the prompt specifically references playoffs or a week range.

Examples:

Prompt: "Award the highest regular season points"
{"label":"Highest Regular Season Points","source":"matchups","filters":[{"field":"isPlayoff","op":"==","value":false}],"compute":null,"groupBy":"managerId","aggregate":{"type":"sum","field":"points"},"rank":"max","limit":10}

Prompt: "Award the biggest blowout"
{"label":"Biggest Blowout","source":"matchups","filters":[{"field":"isPlayoff","op":"==","value":false}],"compute":{"as":"margin","expr":"points_minus_opponentPoints"},"groupBy":null,"aggregate":{"type":"max","field":"margin"},"rank":"max","limit":10}

Prompt: "Award the highest points scored in a single game"
{"label":"Highest Single-Game Points","source":"matchups","filters":[{"field":"isPlayoff","op":"==","value":false}],"compute":null,"groupBy":null,"aggregate":{"type":"max","field":"points"},"rank":"max","limit":10}
`;

export class BonusSpecGenerationError extends Error {}

/**
 * One-time call: turns "award the highest regular season points" into a
 * validated BonusSpec. Called only from the bonus-creation API route —
 * NEVER called on page load or on a schedule.
 */
export async function generateBonusSpec(promptText: string): Promise<BonusSpec> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: promptText }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new BonusSpecGenerationError("Claude did not return a text response");
  }

  let parsed: unknown;
  try {
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new BonusSpecGenerationError("Claude's response was not valid JSON");
  }

  const result = BonusSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new BonusSpecGenerationError(
      `Claude's spec failed validation: ${result.error.message}`
    );
  }

  return result.data;
}
