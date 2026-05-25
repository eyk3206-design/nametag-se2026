import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto, initializeStorageIfNeeded } from "@/lib/storage";
import sharp from "sharp";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eykman04";

export async function POST(request: NextRequest) {
  const password = request.headers.get("x-admin-password");
  if (password !== ADMIN_PASSWORD) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await initializeStorageIfNeeded();

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const sobatId = formData.get("sobat_id") as string | null;

    if (!file) return NextResponse.json({ error: "File foto tidak ditemukan" }, { status: 400 });
    if (!sobatId) return NextResponse.json({ error: "Sobat ID diperlukan" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP" }, { status: 400 });
    }

    // Convert to PNG format and resize to reasonable dimensions (max 600x800)
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const pngBuffer = await sharp(inputBuffer)
      .resize(600, 800, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 90 })
      .toBuffer();

    // Always save as PNG
    const filename = `${sobatId}.png`;
    const photoUrl = await uploadPhoto(filename, pngBuffer, "image/png");

    return NextResponse.json({ success: true, message: "Foto berhasil diunggah (format PNG)", filename, photoUrl });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: "Gagal mengunggah foto" }, { status: 500 });
  }
}
