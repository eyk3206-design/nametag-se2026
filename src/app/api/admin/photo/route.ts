import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto, initializeStorageIfNeeded } from "@/lib/storage";

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

    const ext = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : file.type === "image/webp" ? "webp" : "jpg";
    const filename = `${sobatId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const photoUrl = await uploadPhoto(filename, buffer, file.type);

    return NextResponse.json({ success: true, message: "Foto berhasil diunggah", filename, photoUrl });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: "Gagal mengunggah foto" }, { status: 500 });
  }
}
