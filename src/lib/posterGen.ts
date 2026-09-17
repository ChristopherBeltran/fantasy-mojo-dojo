import { GoogleGenAI } from "@google/genai";
import { put, del } from "@vercel/blob";
import type { Manager, ManagerPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";
import { getSetting } from "@/lib/settings";

type ManagerWithPhotos = Manager & { photos: ManagerPhoto[] };

// Editable from /commissioner/settings without a code deploy — see
// getPosterPromptTemplate. {{placeholders}} are substituted by
// renderPromptTemplate; teamAApparelInstruction/teamBApparelInstruction are
// pre-computed (possibly empty) strings, not conditionals the template
// itself needs to handle.
export const POSTER_PROMPT_SETTING_KEY = "posterPrompt";

export const DEFAULT_POSTER_PROMPT_TEMPLATE = `Create a dynamic, split-screen sports showdown poster for a fantasy football matchup in a sharp comic-book / cel-shaded illustration style — NOT photorealistic, and NOT a simple cartoon.

COMPOSITION & LAYOUT:
- Left side of the image features Character A ("{{teamA}}").
- Right side of the image features Character B ("{{teamB}}").
- Separate the two sides with a strong central "VS" split-screen line or energy divide.

CHARACTER STYLING & ACCURACY:
- Character A (Left) MUST be drawn referencing ONLY [IMAGE INPUT SET 1]. Study ALL photos in that set together as different views of the SAME person, and identify what makes Person A specifically recognizable — exact head/hair shape, hairline, hair color, facial hair style and coverage, eyebrow shape, skin tone, and build. Exaggerate whichever of these features is most visually distinctive rather than smoothing it into a generic athlete look.
- Character B (Right) MUST be drawn referencing ONLY [IMAGE INPUT SET 2]. Study ALL photos in that set together as different views of the SAME person, and identify what makes Person B specifically recognizable — exact head/hair shape, hairline, hair color, facial hair style and coverage, eyebrow shape, skin tone, and build. Exaggerate whichever of these features is most visually distinctive rather than smoothing it into a generic athlete look.
- CRITICAL: Person A and Person B must be visibly, obviously different individuals — different face shapes, different hair, different builds. If you cannot clearly see a feature (e.g. eyes hidden by sunglasses in every photo), still vary hair, head shape, facial hair, and skin tone based on what IS visible rather than defaulting to a generic face. Do not mix, smooth, or average their facial characteristics, and do not let both characters converge toward the same generic look.

APPAREL & CLOTHING:
{{teamAApparelInstruction}}
{{teamBApparelInstruction}}

TEXT RULES:
- Render "{{teamA}}" clearly as stylized graphic poster text on the left.
- Render "{{teamB}}" clearly as stylized graphic poster text on the right.
- DO NOT render generic words like "Team A", "Team B", "Matchup", or "Showdown".`;

export async function getPosterPromptTemplate(): Promise<{
  value: string;
  isDefault: boolean;
}> {
  const stored = await getSetting(POSTER_PROMPT_SETTING_KEY);
  return stored
    ? { value: stored, isDefault: false }
    : { value: DEFAULT_POSTER_PROMPT_TEMPLATE, isDefault: true };
}

function renderPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? "");
}

function apparelInstruction(
  side: "A" | "B",
  teamName: string,
  favoriteNflTeam: string | null,
) {
  if (!favoriteNflTeam) return "";
  return ` For Character ${side} ("${teamName}"), either include subtle streetwear apparel elements like a casual hoodie featuring ${favoriteNflTeam} color accents. DO NOT draw a full football uniform, helmet, or heavy shoulder pads. OR include some element of ${favoriteNflTeam} in the background, such as their mascot, their town, their stadium or a group of their fans.`;
}

interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
}

async function fetchAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch reference photo (${res.status}): ${url}`);
  }
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}

async function generatePosterImage(
  teamAName: string,
  teamAFavoriteNflTeam: string | null,
  teamAPhotoUrls: string[],
  teamBName: string,
  teamBFavoriteNflTeam: string | null,
  teamBPhotoUrls: string[],
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const [photosA, photosB, promptTemplate] = await Promise.all([
    Promise.all(teamAPhotoUrls.map(fetchAsBase64)),
    Promise.all(teamBPhotoUrls.map(fetchAsBase64)),
    getPosterPromptTemplate(),
  ]);

  const promptText = renderPromptTemplate(promptTemplate.value, {
    teamA: teamAName,
    teamB: teamBName,
    teamAApparelInstruction: apparelInstruction(
      "A",
      teamAName,
      teamAFavoriteNflTeam,
    ),
    teamBApparelInstruction: apparelInstruction(
      "B",
      teamBName,
      teamBFavoriteNflTeam,
    ),
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    config: {
      imageConfig: { aspectRatio: "3:4" },
    },
    contents: [
      // 1. First, explicitly bind Team A's photos
      {
        text: `[IMAGE INPUT SET 1]: These ${photosA.length} photos belong EXCLUSIVELY to Character A ("${teamAName}"). Use these photos ONLY for the left character.`,
      },
      ...photosA.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),

      // 2. Explicitly bind Team B's photos
      {
        text: `[IMAGE INPUT SET 2]: These ${photosB.length} photos belong EXCLUSIVELY to Character B ("${teamBName}"). Use these photos ONLY for the right character.`,
      },
      ...photosB.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),

      // 3. Main Prompt at the end to act as the synthesis directive
      { text: promptText },
    ],
  });

  const imageData = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData,
  )?.inlineData;
  if (!imageData?.data) {
    throw new Error("Gemini response did not include an image");
  }

  return {
    bytes: Buffer.from(imageData.data, "base64"),
    mimeType: imageData.mimeType ?? "image/png",
  };
}

/**
 * Generates and saves one pairing's poster — uploads to Blob, creates the
 * MatchupPoster row. Assumes any previous poster/row for this pairing+week
 * has already been dealt with by the caller (skipped, or deleted for a
 * regenerate).
 */
async function createPoster(
  leagueId: string,
  week: number,
  season: string,
  managerA: ManagerWithPhotos,
  managerB: ManagerWithPhotos,
) {
  const image = await generatePosterImage(
    managerA.teamName ?? managerA.displayName,
    managerA.favoriteNflTeam,
    managerA.photos.map((p) => p.url),
    managerB.teamName ?? managerB.displayName,
    managerB.favoriteNflTeam,
    managerB.photos.map((p) => p.url),
  );

  const blob = await put(
    // Timestamped so a regenerated poster gets a fresh URL rather than
    // colliding with (and needing to invalidate caches for) the old one.
    `posters/${leagueId}/week-${week}-${managerA.id}-${managerB.id}-${Date.now()}.png`,
    image.bytes,
    {
      access: "public",
      contentType: image.mimeType,
    },
  );

  return prisma.matchupPoster.create({
    data: {
      leagueId,
      week,
      season,
      managerAId: managerA.id,
      managerBId: managerB.id,
      imageUrl: blob.url,
    },
  });
}

/**
 * Generates any missing matchup posters for the league's current week.
 * Idempotent and safe to call on every cron run: a pair already has a
 * poster, or is missing a reference photo for either manager, is skipped
 * rather than (re-)generated. This is what makes "run once the new week
 * begins" work — the first run after a new week appears finds no posters
 * yet for that week's pairs and generates them; every run after that for
 * the same week is a no-op.
 */
export async function generateWeeklyPosters(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
  });
  const week = await getCurrentWeek(leagueId);
  if (!week) {
    return { week: null, generated: 0, skipped: 0, failed: 0 };
  }

  const pairs = await getWeekPairs(leagueId, week);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const pair of pairs) {
    const [managerAId, managerBId] = [pair.managerId, pair.opponentId!].sort();
    const [managerA, managerB] =
      managerAId === pair.managerId
        ? [pair.manager, pair.opponent!]
        : [pair.opponent!, pair.manager];

    if (managerA.photos.length === 0 || managerB.photos.length === 0) {
      skipped++;
      continue;
    }

    const existing = await prisma.matchupPoster.findUnique({
      where: {
        leagueId_week_managerAId_managerBId: {
          leagueId,
          week,
          managerAId,
          managerBId,
        },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await createPoster(leagueId, week, league.season, managerA, managerB);
      generated++;
    } catch (err) {
      console.error(
        `Poster generation failed for ${managerAId} vs ${managerBId}, week ${week}`,
        err,
      );
      failed++;
    }
  }

  return { week, generated, skipped, failed };
}

/**
 * Deletes the current week's poster for a specific pairing (if one exists,
 * blob included) and generates a fresh one. Unlike generateWeeklyPosters,
 * this always regenerates rather than skipping an existing poster — it's
 * the manual "Regenerate" action, not the idempotent cron path.
 */
export async function regeneratePoster(
  leagueId: string,
  managerAId: string,
  managerBId: string,
) {
  // Canonical order matches how pairs are stored — see the MatchupPoster
  // schema comment — so it doesn't matter which order the caller passes
  // the two manager ids in.
  const [sortedAId, sortedBId] = [managerAId, managerBId].sort();

  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
  });
  const week = await getCurrentWeek(leagueId);
  if (!week) {
    throw new Error("No synced matchup data yet");
  }

  const [managerA, managerB] = await Promise.all([
    prisma.manager.findUniqueOrThrow({
      where: { id: sortedAId },
      include: { photos: true },
    }),
    prisma.manager.findUniqueOrThrow({
      where: { id: sortedBId },
      include: { photos: true },
    }),
  ]);

  if (managerA.photos.length === 0 || managerB.photos.length === 0) {
    throw new Error(
      "Both managers need at least one reference photo to generate a poster",
    );
  }

  const existing = await prisma.matchupPoster.findUnique({
    where: {
      leagueId_week_managerAId_managerBId: {
        leagueId,
        week,
        managerAId: sortedAId,
        managerBId: sortedBId,
      },
    },
  });
  if (existing) {
    await del(existing.imageUrl).catch((err) =>
      console.error("Failed to delete old poster blob", err),
    );
    await prisma.matchupPoster.delete({ where: { id: existing.id } });
  }

  return createPoster(leagueId, week, league.season, managerA, managerB);
}

/**
 * Regenerates every current-week pairing that already has a poster — the
 * "regenerate all" offered after saving a new prompt on
 * /commissioner/settings. Pairings without a poster yet are left alone
 * (same as generateWeeklyPosters/the cron, not this manual action's job).
 */
export interface RegenerateAllProgress {
  completed: number;
  total: number;
  success: boolean;
}

export async function regenerateAllCurrentWeekPosters(
  leagueId: string,
  onProgress?: (progress: RegenerateAllProgress) => void,
) {
  const week = await getCurrentWeek(leagueId);
  if (!week) {
    return { week: null, regenerated: 0, failed: 0 };
  }

  const posters = await prisma.matchupPoster.findMany({
    where: { leagueId, week },
  });

  let regenerated = 0;
  let failed = 0;

  for (const poster of posters) {
    let success = true;
    try {
      await regeneratePoster(leagueId, poster.managerAId, poster.managerBId);
      regenerated++;
    } catch (err) {
      console.error(
        `Poster regeneration failed for ${poster.managerAId} vs ${poster.managerBId}, week ${week}`,
        err,
      );
      failed++;
      success = false;
    }
    onProgress?.({
      completed: regenerated + failed,
      total: posters.length,
      success,
    });
  }

  return { week, regenerated, failed };
}
