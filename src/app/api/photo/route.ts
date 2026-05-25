import { NextRequest, NextResponse } from "next/server";
import { getPhotoUrl, getPhotoBuffer } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) return new NextResponse("Filename required", { status: 400 });

    // Try to get photo buffer directly (works for both blob and local)
    const buffer = await getPhotoBuffer(filename);
    if (buffer) {
      const ext = filename.toLowerCase().split(".").pop();
      const contentType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return getPlaceholderSVG();
  } catch {
    return getPlaceholderSVG();
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

function getPlaceholderSVG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
    <rect width="200" height="240" fill="#FFF7ED"/>
    <circle cx="100" cy="90" r="40" fill="#FDBA74"/>
    <circle cx="100" cy="80" r="20" fill="#C2410C" opacity="0.3"/>
    <path d="M60 140 Q100 120 140 140 L140 200 Q100 210 60 200 Z" fill="#C2410C" opacity="0.3"/>
    <text x="100" y="230" text-anchor="middle" fill="#C2410C" font-size="12" font-family="sans-serif">Foto</text>
  </svg>`;
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
  });
}
