import { NextRequest, NextResponse } from "next/server";
import { getPhotoUrl } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) return new NextResponse("Filename required", { status: 400 });

    // If filename is already a full URL (from Vercel Blob), proxy it server-side
    if (filename.startsWith("http")) {
      return await proxyImage(filename);
    }

    // Sanitize filename - prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!sanitizedFilename) return getPlaceholderSVG();

    // Get photo URL from storage layer
    const photoUrl = await getPhotoUrl(sanitizedFilename);

    if (photoUrl) {
      // If it's a full URL (Vercel Blob), proxy it server-side
      // This is CRITICAL: we proxy instead of redirect so that
      // client-side fetch can convert to base64 without CORS issues
      if (photoUrl.startsWith("http")) {
        return await proxyImage(photoUrl);
      }

      // Try to read local file
      try {
        const { readFileSync, existsSync } = await import("fs");
        const { join } = await import("path");

        const uploadPath = join(process.cwd(), "upload", sanitizedFilename);
        if (existsSync(uploadPath)) {
          const fileBuffer = readFileSync(uploadPath);
          const ext = sanitizedFilename.split(".").pop()?.toLowerCase();
          const contentType =
            ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";

          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      } catch { /* fs not available */ }
    }

    // Photo not found - return placeholder
    return getPlaceholderSVG();
  } catch {
    return getPlaceholderSVG();
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Proxy an image URL server-side and return the binary data
// This avoids CORS issues on the client side
async function proxyImage(url: string): Promise<NextResponse> {
  try {
    const res = await fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return getPlaceholderSVG();

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return getPlaceholderSVG();
  }
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
