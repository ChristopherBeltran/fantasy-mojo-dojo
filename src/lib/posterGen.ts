import { GoogleGenAI } from "@google/genai";
import { put, del } from "@vercel/blob";
import type { Manager, ManagerPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";
import { getSetting } from "@/lib/settings";

type ManagerWithPhotos = Manager & { photos: ManagerPhoto[] };

// Editable from /commissioner/settings without a code deploy — see
// getPosterPromptTemplate. {{placeholders}} are substituted by
// renderPromptTemplate; teamABackgroundInstruction/teamBBackgroundInstruction
// are pre-computed (possibly empty) strings, not conditionals the template
// itself needs to handle. This is the COMBINE step's prompt — it receives
// two already-generated, identity-locked character portraits (see
// generateCharacterPortrait) and only has to place them in one scene, so it
// doesn't need the identity-fidelity instructions the portrait prompt has.
export const POSTER_PROMPT_SETTING_KEY = "posterPrompt";

export const DEFAULT_POSTER_PROMPT_TEMPLATE = `Combine the two provided character illustrations into one dynamic fantasy football matchup poster in a sharp comic-book / cel-shaded illustration style — NOT photorealistic, and NOT a simple cartoon.

CHARACTERS:
- The first character image is Character A ("{{teamA}}"). The second character image is Character B ("{{teamB}}"). Preserve each character's exact appearance, identity, and clothing from their reference image — do not redesign, blend, or average their features.
- Compose the scene so Character A and Character B are clearly facing off against each other — for example squaring up, standing back-to-back, or in a dynamic dueling pose — so it is unmistakable that this is a head-to-head matchup between two distinct people. A hard split-screen is not required; any layout is fine as long as the confrontation is obvious.

BACKGROUND & SCENE:
- Build one cohesive background/scene (not two separate, disconnected halves) that blends visual elements from both sides below.
{{teamABackgroundInstruction}}
{{teamBBackgroundInstruction}}
- If neither side has a background instruction above, use a generic dynamic fantasy-football stadium/energy backdrop.

TEXT RULES:
- Render "{{teamA}}" and "{{teamB}}" clearly as stylized graphic poster text, positioned so it's obvious which name belongs to which character.
- DO NOT render generic words like "Team A", "Team B", "Matchup", or "Showdown".`;

// Fixed, not settings-backed — this is the mechanical identity-fidelity
// step (see generateCharacterPortrait) rather than the creative step a
// commissioner would want to keep tuning.
const PORTRAIT_PROMPT_TEMPLATE = `Create a single character illustration in a sharp comic-book / cel-shaded style — NOT photorealistic, and NOT a simple cartoon — of Character ("{{teamName}}"), posed confidently, on a plain neutral studio background (flat, no scenery, no props, no other people) so the character can be cleanly placed into a different scene later.

CHARACTER ACCURACY:
- Reference ONLY the provided photos, which are different views of the SAME person. Identify what makes them specifically recognizable — exact head/hair shape, hairline, hair color, facial hair style and coverage, eyebrow shape, skin tone, and build. Exaggerate whichever of these features is most visually distinctive rather than smoothing it into a generic athlete look.
- If you cannot clearly see a feature (e.g. eyes hidden by sunglasses in every photo), still vary hair, head shape, facial hair, and skin tone based on what IS visible rather than defaulting to a generic face.

APPAREL:
{{apparelInstruction}}

Do not render any text, logos, or graphic overlays in this image.`;

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
  teamName: string,
  favoriteNflTeam: string | null,
): string {
  const nflOption = favoriteNflTeam
    ? ` Their favorite real-world NFL team is ${favoriteNflTeam} — sometimes reflect this with a jersey or apparel using that team's colors, but not every time.`
    : "";
  return `Look at what the person is actually wearing across the reference photos and let that inform the outfit — if a clothing style, color, or accessory shows up consistently, carry it into the illustration. Vary the result rather than defaulting to the same look every time: sometimes a full sports jersey, sometimes a plain t-shirt or casual hoodie, sometimes an outfit with no team branding at all.${nflOption} You may instead draw inspiration from their fantasy football team name ("${teamName}") for a themed graphic tee or fun apparel detail when it naturally lends itself to one — this is optional, not required for every character.`;
}

function backgroundInstruction(
  side: "A" | "B",
  teamName: string,
  favoriteNflTeam: string | null,
): string {
  if (!favoriteNflTeam) return "";
  return `- For the side of the scene associated with Character ${side} ("${teamName}"), let the background/scenery nod to ${favoriteNflTeam} — for example their mascot, stadium, team colors, or fans — blended naturally into the overall scene.`;
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

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }
  return new GoogleGenAI({ apiKey });
}

function extractGeneratedImage(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
}): GeneratedImage {
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

// Generates one manager's character art in isolation, so identity fidelity
// isn't competing against a second person's photos in the same generation
// (which was the root cause of posters showing the same manager twice).
async function generateCharacterPortrait(
  teamName: string,
  favoriteNflTeam: string | null,
  photoUrls: string[],
): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const photos = await Promise.all(photoUrls.map(fetchAsBase64));

  const promptText = renderPromptTemplate(PORTRAIT_PROMPT_TEMPLATE, {
    teamName,
    apparelInstruction: apparelInstruction(teamName, favoriteNflTeam),
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    config: {
      imageConfig: { aspectRatio: "3:4" },
    },
    contents: [
      {
        text: `[REFERENCE PHOTOS]: These ${photos.length} photos are different views of the SAME person, Character ("${teamName}"). Use them to identify this specific person's likeness.`,
      },
      ...photos.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),
      { text: promptText },
    ],
  });

  return extractGeneratedImage(response);
}

// Composes two already identity-locked character portraits into the final
// poster. Background/scene theming lives here (not in the portrait step)
// so both sides' team flavor can be blended into one cohesive scene rather
// than each portrait separately inventing an unrelated backdrop.
async function combinePosterImage(
  teamAName: string,
  teamAFavoriteNflTeam: string | null,
  portraitA: GeneratedImage,
  teamBName: string,
  teamBFavoriteNflTeam: string | null,
  portraitB: GeneratedImage,
): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const promptTemplate = await getPosterPromptTemplate();

  const promptText = renderPromptTemplate(promptTemplate.value, {
    teamA: teamAName,
    teamB: teamBName,
    teamABackgroundInstruction: backgroundInstruction(
      "A",
      teamAName,
      teamAFavoriteNflTeam,
    ),
    teamBBackgroundInstruction: backgroundInstruction(
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
      {
        text: `[CHARACTER A]: This image is Character A ("${teamAName}"). Preserve their exact appearance and clothing.`,
      },
      {
        inlineData: {
          mimeType: portraitA.mimeType,
          data: portraitA.bytes.toString("base64"),
        },
      },
      {
        text: `[CHARACTER B]: This image is Character B ("${teamBName}"). Preserve their exact appearance and clothing.`,
      },
      {
        inlineData: {
          mimeType: portraitB.mimeType,
          data: portraitB.bytes.toString("base64"),
        },
      },
      { text: promptText },
    ],
  });

  return extractGeneratedImage(response);
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
  const teamAName = managerA.teamName ?? managerA.displayName;
  const teamBName = managerB.teamName ?? managerB.displayName;

  const [portraitA, portraitB] = await Promise.all([
    generateCharacterPortrait(
      teamAName,
      managerA.favoriteNflTeam,
      managerA.photos.map((p) => p.url),
    ),
    generateCharacterPortrait(
      teamBName,
      managerB.favoriteNflTeam,
      managerB.photos.map((p) => p.url),
    ),
  ]);

  const image = await combinePosterImage(
    teamAName,
    managerA.favoriteNflTeam,
    portraitA,
    teamBName,
    managerB.favoriteNflTeam,
    portraitB,
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
