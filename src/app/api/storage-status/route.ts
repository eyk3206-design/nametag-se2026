import { NextResponse } from "next/server";
import { isBlobMode, isVercelEnv } from "@/lib/storage";

export async function GET() {
  const blobMode = isBlobMode();
  const vercel = isVercelEnv();

  let storageType = "Local Filesystem";
  let writable = true;
  let message = "";

  if (vercel && !blobMode) {
    storageType = "Vercel (tanpa Blob - READ ONLY)";
    writable = false;
    message = "Aktifkan Vercel Blob Storage agar fitur admin berfungsi. Buka Vercel Dashboard → Project → Storage → Create Blob → Link → Redeploy.";
  } else if (blobMode) {
    storageType = "Vercel Blob (Cloud)";
    writable = true;
    message = "Semua fitur admin tersedia.";
  }

  return NextResponse.json({
    blobMode,
    vercel,
    storageType,
    writable,
    message,
  });
}
