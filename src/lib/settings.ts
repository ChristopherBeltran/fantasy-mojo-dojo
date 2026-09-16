import { prisma } from "@/lib/prisma";

// Generic admin-tunable key/value store — see the Setting model comment in
// schema.prisma. Domain-specific defaults/keys live next to their feature
// (e.g. the poster prompt default lives in posterGen.ts), not here.

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// No row for a key means "use the hardcoded default" — see each key's own
// getter (e.g. getPosterPromptTemplate) — so resetting is just deleting it.
export async function resetSetting(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}
