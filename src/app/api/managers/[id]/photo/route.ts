import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_MANAGER = 3;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const manager = await prisma.manager.findUnique({
    where: { id: params.id },
    include: { photos: true },
  });
  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  if (manager.photos.length >= MAX_PHOTOS_PER_MANAGER) {
    return NextResponse.json(
      { error: `Manager already has ${MAX_PHOTOS_PER_MANAGER} photos — delete one first.` },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request must be multipart/form-data" }, { status: 400 });
  }
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'photo' file field" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`managers/${manager.id}/photo-${Date.now()}`, file, {
      access: "public",
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("Photo upload to Blob storage failed", err);
    return NextResponse.json({ error: "Photo storage isn't configured or the upload failed" }, { status: 500 });
  }

  const photo = await prisma.managerPhoto.create({
    data: { managerId: manager.id, url: blobUrl },
  });

  return NextResponse.json({ photo });
}
