import { GoogleGenAI } from "@google/genai";
import { put, del } from "@vercel/blob";
import type { Manager, ManagerPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";
import { getSetting } from "@/lib/settings";

type ManagerWithPhotos = Manager & { photos: ManagerPhoto[] };

const IMAGE_MODEL = "gemini-3.1-flash-image";
const TEXT_MODEL = "gemini-3.8-flash";

// Editable from /commissioner/settings without a code deploy — see
// getPosterPromptTemplate. {{placeholders}} are substituted by
// renderPromptTemplate; teamABackgroundInstruction/teamBBackgroundInstruction
// are pre-computed (possibly empty) strings, not conditionals the template
// itself needs to handle. This is the COMBINE step's prompt — it receives
// two already-generated, identity-locked character portraits (see
// generateCharacterPortrait) and only has to place them in one scene. The
// anti-blending rules for that step are appended in code (see
// identityLockInstruction) so a custom template can't drop them.
export const POSTER_PROMPT_SETTING_KEY = "posterPrompt";

export const DEFAULT_POSTER_PROMPT_TEMPLATE = `Combine the two provided character illustrations into one dynamic fantasy football matchup poster in a sharp comic-book / cel-shaded illustration style — NOT photorealistic, and NOT a simple cartoon.

CHARACTERS:
- The first character image is Character A ("{{teamA}}"). The second character image is Character B ("{{teamB}}"). They are two DIFFERENT people. Preserve each character's exact appearance, identity, and clothing from their own reference image — do not redesign, blend, or average their features, and do not copy any feature from one character onto the other.
- Place Character A on the LEFT half of the poster and Character B on the RIGHT half, each fully visible with clear space between them — no overlapping, touching, or back-to-back poses. Have them face toward each other (or toward the viewer) so it's unmistakable this is a head-to-head matchup between two distinct people.
- Give each character their own pose and expression rather than mirroring the same pose on both sides.

BACKGROUND & SCENE:
- Build one cohesive background/scene (not two separate, disconnected halves) that blends visual elements from both sides below.
{{teamABackgroundInstruction}}
{{teamBBackgroundInstruction}}
- If neither side has a background instruction above, use a generic dynamic fantasy-football stadium/energy backdrop.

TEXT RULES:
- Render "{{teamA}}" above or near Character A on the left and "{{teamB}}" above or near Character B on the right, as clearly stylized graphic poster text.
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
  const fallbackOutfit = favoriteNflTeam
    ? `a ${favoriteNflTeam} football jersey, or a t-shirt in ${favoriteNflTeam} colors`
    : `a solid-color t-shirt or a football-style jersey with no real team branding`;
  return `Choose the outfit in this order:
1. REAL EVERYDAY STYLE: Look at what the person wears across the reference photos. If they show a clear, specific casual style (e.g. a flannel or button-up shirt, a polo, a graphic tee, a baseball cap, a particular color they favor), dress them in that style with those specifics. Match the actual garment type, not just the color.
2. FALLBACK: If the photos don't show a clear casual style (only formal wear, only close-up face shots, or plain generic clothing), dress them in ${fallbackOutfit}.

NEVER USE:
- Formal or occasion wear: suits, blazers, sport coats, ties, bow ties, tuxedos, vests, dress shirts buttoned up with a jacket, or wedding/event attire. Do this even if every reference photo shows it. Ignore that clothing entirely and use the fallback.
- Work uniforms, scrubs, costumes, or swimwear from the photos.
- Hoodies or hooded sweatshirts, unless the person is clearly wearing one in the reference photos. Never use a hoodie as a generic default.

Optionally, you may add a small nod to their fantasy team name ("${teamName}") as a graphic on a t-shirt or jersey. Only do this when the name naturally lends itself to one, and don't add it every time.`;
}

function backgroundInstruction(
  side: "A" | "B",
  teamName: string,
  favoriteNflTeam: string | null,
): string {
  if (!favoriteNflTeam) return "";
  // Left unconstrained, the model tends to scatter the team logo all over
  // its side of the scene (walls, fans, floating badges). Keeping the nod
  // mostly to color and atmosphere, with at most one logo, keeps it subtle.
  return `- For the side of the scene associated with Character ${side} ("${teamName}"), give the background a subtle nod to ${favoriteNflTeam}, mainly through team colors, lighting, and atmosphere (optionally their stadium or fans). Keep it understated: show the ${favoriteNflTeam} logo at most ONCE on this side, small and in the background, or not at all. Do not repeat the logo, mascot, or team wordmark across walls, signs, banners, fans, or floating badges.`;
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
    model: IMAGE_MODEL,
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

// Writes a short, plain-text list of a portrait's distinguishing traits.
// Handing the combine step these as text — alongside the images — gives the
// model an explicit checklist of what separates the two people, which is
// what keeps it from drifting toward one averaged face (e.g. giving both
// characters the same beard or glasses). Best-effort: a failure here just
// means the combine step runs on the images alone.
async function describeCharacter(
  portrait: GeneratedImage,
): Promise<string | null> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: portrait.mimeType,
            data: portrait.bytes.toString("base64"),
          },
        },
        {
          text: "List this character's most distinguishing physical traits as one comma-separated line, covering: head/hair (style, length, color, hairline or baldness), facial hair (or clean-shaven), eyewear (or none), skin tone, build, and outfit (garment type and main colors, any number). Be concrete and visual. Output only the line.",
        },
      ],
    });
    return response.text?.trim() || null;
  } catch (err) {
    console.error("Character description failed", err);
    return null;
  }
}

function characterLabel(
  side: "A" | "B",
  teamName: string,
  description: string | null,
): string {
  const position = side === "A" ? "LEFT" : "RIGHT";
  const traits = description ? ` Distinguishing traits: ${description}.` : "";
  return `[CHARACTER ${side}]: This image is Character ${side} ("${teamName}"), who goes on the ${position} side of the poster. Preserve their exact face, hair, facial hair, eyewear, skin tone, build, and clothing from this image only.${traits}`;
}

// Appended after the (commissioner-editable) template rather than living in
// it, so the anti-blending rules still apply if a custom prompt has been
// saved that doesn't mention them.
function identityLockInstruction(
  teamAName: string,
  descriptionA: string | null,
  teamBName: string,
  descriptionB: string | null,
): string {
  const traitLines =
    descriptionA && descriptionB
      ? `\n- Character A (LEFT, "${teamAName}"): ${descriptionA}\n- Character B (RIGHT, "${teamBName}"): ${descriptionB}\nCheck each character against their own line — no trait from one line may appear on the other character unless it's listed for both.`
      : "";
  return `IDENTITY LOCK (highest priority, overrides anything above):
Character A and Character B are two different real people and must look like two clearly different people in the final poster. Draw Character A only from the Character A image and Character B only from the Character B image. Do not merge, average, or swap their faces, hairstyles, facial hair, eyewear, skin tones, builds, or outfits. Character A is on the LEFT, Character B is on the RIGHT, with space between them.${traitLines}`;
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
  const [promptTemplate, descriptionA, descriptionB] = await Promise.all([
    getPosterPromptTemplate(),
    describeCharacter(portraitA),
    describeCharacter(portraitB),
  ]);

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
    model: IMAGE_MODEL,
    config: {
      imageConfig: { aspectRatio: "3:4" },
    },
    contents: [
      { text: characterLabel("A", teamAName, descriptionA) },
      {
        inlineData: {
          mimeType: portraitA.mimeType,
          data: portraitA.bytes.toString("base64"),
        },
      },
      { text: characterLabel("B", teamBName, descriptionB) },
      {
        inlineData: {
          mimeType: portraitB.mimeType,
          data: portraitB.bytes.toString("base64"),
        },
      },
      { text: promptText },
      {
        text: identityLockInstruction(
          teamAName,
          descriptionA,
          teamBName,
          descriptionB,
        ),
      },
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
