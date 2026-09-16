import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  const photo = await prisma.managerPhoto.findUnique({ where: { id: params.photoId } });
  if (!photo || photo.managerId !== params.id) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await del(photo.url).catch((err) => console.error("Failed to delete photo blob", err));
  await prisma.managerPhoto.delete({ where: { id: photo.id } });

  return NextResponse.json({ ok: true });
}
