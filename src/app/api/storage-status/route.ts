import { NextResponse } from "next/server";
import { getStorageModeInfo } from "@/lib/storage";

export async function GET() {
  const info = getStorageModeInfo();

  // For Blob mode, test connection
  let message = info.description;
  if (info.mode === "vercel-blob") {
    try {
      const { list } = await import("@vercel/blob");
      await list({ limit: 1 });
      message += " Koneksi Blob: OK";
    } catch (err) {
      message += ` Koneksi Blob: GAGAL - ${err instanceof Error ? err.message : "Unknown error"}`;
      return NextResponse.json({
        mode: info.mode,
        label: info.label,
        description: message,
        writable: false,
        path: info.path,
        blobMode: true,
        localDataDir: false,
      });
    }
  }

  return NextResponse.json({
    mode: info.mode,
    label: info.label,
    description: message,
    writable: info.writable,
    path: info.path,
    blobMode: info.mode === "vercel-blob",
    localDataDir: info.mode === "local-data-dir",
  });
}
