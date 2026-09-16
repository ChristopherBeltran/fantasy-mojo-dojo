import { GoogleGenAI } from "@google/genai";
import { put, del } from "@vercel/blob";
import type { Manager, ManagerPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";

type ManagerWithPhotos = Manager & { photos: ManagerPhoto[] };

function apparelInstruction(
  side: "A" | "B",
  teamName: string,
  favoriteNflTeam: string | null,
) {
  if (!favoriteNflTeam) return "";
  return ` Dress Team ${side}'s character in apparel (jersey, colors, or
logo elements) inspired by the ${favoriteNflTeam} — that's ${teamName}'s
favorite real-world NFL team.`;
}

const POSTER_PROMPT = (
  teamA: string,
  teamAFavoriteNflTeam: string | null,
  teamB: string,
  teamBFavoriteNflTeam: string | null,
) => `Create a fun, stylized sports-poster illustration for a
fantasy football head-to-head matchup, in a bold graphic-design / cartoon
illustration style — NOT photorealistic. Use each side's reference photos
only as loose inspiration for that person's general look, rendered as an
illustrated character rather than a literal photo likeness. Compose it like
a "VS" showdown poster: dynamic angles, dramatic lighting, team-vs-team
energy. Render each fantasy team's name as bold poster-style text on that
side of the composition "${teamA}" vs. "${teamB}".
${apparelInstruction("A", teamA, teamAFavoriteNflTeam)}${apparelInstruction("B", teamB, teamBFavoriteNflTeam)}

IMPORTANT: Team A and Team B are two different real people. Base each
character ONLY on that side's own reference photos (their own skin tone,
build, and features) — do not blend, average, or otherwise let one
person's appearance influence the other's character. The two characters
should look like two distinct individuals, not variations of the same
person.

TEXT RULES: "Team A" and "Team B" above are labels for this prompt only —
never render the literal words "Team A" or "Team B" anywhere in the image.
Do not render any generic placeholder or title text either, such as
"Team A vs Team B", "Fantasy Football Showdown", "Fantasy Football
Matchup", or similar boilerplate. The only text that should appear in the
image is each side's actual fantasy team name given above (rendered as
poster-style text), plus whatever real text is naturally part of a
character's apparel (e.g. a jersey number or NFL team wordmark).`;

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
  const [photosA, photosB] = await Promise.all([
    Promise.all(teamAPhotoUrls.map(fetchAsBase64)),
    Promise.all(teamBPhotoUrls.map(fetchAsBase64)),
  ]);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    config: {
      // Default output came out as a near-9:16 sliver (974x1863) — too
      // tall for a poster. 3:4 matches a standard portrait poster shape.
      imageConfig: { aspectRatio: "3:4" },
    },
    contents: [
      {
        text: POSTER_PROMPT(
          teamAName,
          teamAFavoriteNflTeam,
          teamBName,
          teamBFavoriteNflTeam,
        ),
      },
      {
        text: `--- Team A (${teamAName}) reference photos — base Team A's character ONLY on these ${photosA.length} photos ---`,
      },
      ...photosA.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),
      {
        text: `--- Team B (${teamBName}) reference photos — base Team B's character ONLY on these ${photosB.length} photos ---`,
      },
      ...photosB.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),
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
