import { NextResponse } from "next/server";
import { getPosterPromptTemplate, POSTER_PROMPT_SETTING_KEY } from "@/lib/posterGen";
import { setSetting, resetSetting } from "@/lib/settings";

export async function GET() {
  const { value, isDefault } = await getPosterPromptTemplate();
  return NextResponse.json({ value, isDefault });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.value !== "string" || !body.value.trim()) {
    return NextResponse.json({ error: "Missing 'value' string field" }, { status: 400 });
  }

  await setSetting(POSTER_PROMPT_SETTING_KEY, body.value);
  return NextResponse.json({ value: body.value, isDefault: false });
}

export async function DELETE() {
  await resetSetting(POSTER_PROMPT_SETTING_KEY);
  const { value, isDefault } = await getPosterPromptTemplate();
  return NextResponse.json({ value, isDefault });
}
