import { NextRequest, NextResponse } from "next/server";
import { getPhotoUrl } from "@/lib/storage";

// Resolves a photo filename to its actual URL (Vercel Blob or local path)
export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) return NextResponse.json({ error: "Filename required" }, { status: 400 });

    const photoUrl = await getPhotoUrl(filename);
    return NextResponse.json({ url: photoUrl });
  } catch {
    return NextResponse.json({ url: null });
  }
}
