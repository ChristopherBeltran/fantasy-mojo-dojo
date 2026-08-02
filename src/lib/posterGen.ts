import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getWeekPairs } from "@/lib/currentWeek";

const POSTER_PROMPT = (
  teamA: string,
  teamB: string,
) => `Create a fun, stylized sports-poster illustration for a
fantasy football head-to-head matchup, in a bold graphic-design / cartoon
illustration style — NOT photorealistic. Use the two reference photos only
as loose inspiration for each person's general look, rendered as illustrated
characters rather than literal photo likenesses. Compose it like a "VS"
showdown poster: dynamic angles, dramatic lighting, team-vs-team energy.
Team A: "${teamA}". Team B: "${teamB}".`;

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
  teamAPhotoUrl: string,
  teamBName: string,
  teamBPhotoUrl: string,
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const [photoA, photoB] = await Promise.all([
    fetchAsBase64(teamAPhotoUrl),
    fetchAsBase64(teamBPhotoUrl),
  ]);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      { text: POSTER_PROMPT(teamAName, teamBName) },
      { inlineData: { mimeType: photoA.mimeType, data: photoA.data } },
      { inlineData: { mimeType: photoB.mimeType, data: photoB.data } },
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

    if (!managerA.photoUrl || !managerB.photoUrl) {
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
      const image = await generatePosterImage(
        managerA.teamName ?? managerA.displayName,
        managerA.photoUrl,
        managerB.teamName ?? managerB.displayName,
        managerB.photoUrl,
      );

      const blob = await put(
        `posters/${leagueId}/week-${week}-${managerAId}-${managerBId}.png`,
        image.bytes,
        {
          access: "public",
          contentType: image.mimeType,
        },
      );

      await prisma.matchupPoster.create({
        data: {
          leagueId,
          week,
          season: league.season,
          managerAId,
          managerBId,
          imageUrl: blob.url,
        },
      });
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
