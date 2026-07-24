import { NextResponse } from "next/server";
import { computeAndSaveBonusResult } from "@/lib/bonusCompute";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await computeAndSaveBonusResult(params.id);
    return NextResponse.json({ result });
  } catch (err) {
    console.error(`Failed to compute bonus ${params.id}`, err);
    return NextResponse.json({ error: "Computation failed" }, { status: 500 });
  }
}
