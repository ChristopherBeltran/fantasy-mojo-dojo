import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNflTeam } from "@/lib/nflTeams";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const manager = await prisma.manager.findUnique({ where: { id: params.id } });
  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  let body: { team?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request must be JSON" },
      { status: 400 },
    );
  }

  // `team: null` clears the favorite; otherwise it must be one of the 32 real teams.
  if (
    body.team !== null &&
    (typeof body.team !== "string" || !isNflTeam(body.team))
  ) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  const updated = await prisma.manager.update({
    where: { id: manager.id },
    data: { favoriteNflTeam: body.team },
  });


  return NextResponse.json({ manager: updated });
}
