import { NextRequest, NextResponse } from "next/server";
import { getParticipants, getPhotoBuffer } from "@/lib/storage";
import sharp from "sharp";
import QRCode from "qrcode";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Generate nametag PNG server-side using Sharp
// This eliminates ALL CORS and client-side rendering issues
export async function GET(request: NextRequest) {
  const sobatId = request.nextUrl.searchParams.get("sobat_id");
  if (!sobatId) {
    return new NextResponse("sobat_id required", { status: 400 });
  }

  try {
    const participants = await getParticipants();
    const p = participants.find((x) => x.sobat_id.toLowerCase() === sobatId.toLowerCase());
    if (!p) {
      return new NextResponse("Participant not found", { status: 404 });
    }

    const pngBuffer = await generateNametagPNG(p);
    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": `inline; filename="nametag-${p.sobat_id}.png"`,
      },
    });
  } catch (error) {
    console.error("Nametag generation error:", error);
    return new NextResponse("Failed to generate nametag", { status: 500 });
  }
}

async function generateNametagPNG(p: {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}): Promise<Buffer> {
  const W = 600;
  const H = 380;

  // Load logos
  const logoBpsBase64 = loadLogoBase64("logo-bps.png");
  const logoSeBase64 = loadLogoBase64("logo-se.png");

  // Load photo
  const photoBase64 = await loadPhotoBase64(p.photo_filename);

  // Generate QR code
  const qrPngBuffer = await QRCode.toBuffer(p.sobat_id, {
    type: "png",
    width: 216,
    margin: 1,
    color: { dark: "#c2410c", light: "#ffffff" },
  });
  const qrBase64 = qrPngBuffer.toString("base64");

  // Parse gelombang
  const gelParts = p.gelombang.split(" - ");
  const gel = gelParts[0]?.trim() || p.gelombang;
  const waktu = gelParts[1]?.trim() || "";

  // Truncate long text
  const truncate = (str: string, max: number) => (str.length > max ? str.substring(0, max - 1) + "…" : str);

  // Build SVG
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ea580c"/>
      <stop offset="50%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
    <linearGradient id="divGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="50%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
    <clipPath id="photoClip"><rect x="40" y="92" width="120" height="140" rx="8"/></clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- Top bar -->
  <rect width="${W}" height="8" fill="url(#barGrad)"/>

  <!-- Bottom bar -->
  <rect y="${H - 8}" width="${W}" height="8" fill="url(#barGrad)"/>

  <!-- Header logos -->
  <image href="${logoBpsBase64}" x="20" y="20" width="44" height="44"/>

  <!-- Header text -->
  <text x="300" y="34" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="#c2410c" letter-spacing="1">BADAN PUSAT STATISTIK</text>
  <text x="300" y="50" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#9a3412">Kabupaten Tasikmalaya</text>
  <line x1="252" y1="58" x2="276" y2="58" stroke="#f97316" stroke-width="2"/>
  <text x="300" y="62" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="#ea580c" letter-spacing="1.5">PELATIHAN PETUGAS SE2026</text>
  <line x1="324" y1="58" x2="348" y2="58" stroke="#f97316" stroke-width="2"/>

  <image href="${logoSeBase64}" x="536" y="20" width="44" height="44"/>

  <!-- Divider -->
  <rect x="0" y="76" width="${W}" height="3" fill="url(#divGrad)"/>

  <!-- Photo -->
  <rect x="40" y="92" width="120" height="140" rx="8" fill="#fff7ed" stroke="#fb923c" stroke-width="2"/>
  ${photoBase64 ? `<image href="${photoBase64}" x="40" y="92" width="120" height="140" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>` : `
  <circle cx="100" cy="145" r="25" fill="#FDBA74"/>
  <circle cx="100" cy="137" r="12" fill="#C2410C" opacity="0.3"/>
  <path d="M72 170 Q100 155 128 170 L128 210 Q100 220 72 210 Z" fill="#C2410C" opacity="0.3"/>
  <text x="100" y="225" text-anchor="middle" fill="#C2410C" font-size="10" font-family="Arial,sans-serif" font-weight="600">${truncate(p.nama, 6).toUpperCase().substring(0, 2)}</text>
  `}

  <!-- QR Code -->
  <rect x="48" y="244" width="104" height="104" rx="6" fill="#fff" stroke="#fdba74" stroke-width="1"/>
  <image href="data:image/png;base64,${qrBase64}" x="54" y="250" width="92" height="92"/>

  <!-- Name box -->
  <rect x="176" y="92" width="404" height="50" rx="6" fill="#ea580c"/>
  <text x="190" y="110" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="500" fill="white" opacity="0.9" letter-spacing="1.5">NAMA</text>
  <text x="190" y="132" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="white">${truncate(p.nama, 24)}</text>

  <!-- Sobat ID box -->
  <rect x="176" y="150" width="404" height="32" rx="6" fill="#ffedd5"/>
  <text x="190" y="170" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#9a3412" opacity="0.7" letter-spacing="1.5">SOBAT ID</text>
  <text x="280" y="171" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#9a3412">${p.sobat_id}</text>

  <!-- Info grid -->
  <text x="190" y="204" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">KECAMATAN</text>
  <text x="190" y="218" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${truncate(p.kecamatan, 20)}</text>

  <text x="390" y="204" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">GELOMBANG</text>
  <text x="390" y="218" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${truncate(gel, 20)}</text>

  <text x="190" y="248" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">LOKASI</text>
  <text x="190" y="262" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${truncate(p.tempat_pelatihan, 20)}</text>

  <text x="390" y="248" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">KELAS</text>
  <text x="390" y="262" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${p.kelas}</text>

  ${waktu ? `
  <!-- Waktu Pelatihan -->
  <rect x="176" y="280" width="404" height="38" rx="6" fill="#fff7ed" stroke="#fed7aa" stroke-width="1"/>
  <text x="190" y="298" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#ea580c" letter-spacing="1">WAKTU PELATIHAN</text>
  <text x="190" y="312" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#9a3412">${truncate(waktu, 45)}</text>
  ` : ''}
</svg>`;

  // Convert SVG to PNG at 3x scale using Sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(W * 3, H * 3, { fit: "fill" })
    .png()
    .toBuffer();

  return pngBuffer;
}

function loadLogoBase64(filename: string): string {
  try {
    const filePath = join(process.cwd(), "public", filename);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {}
  // Fallback: empty transparent 1x1 PNG
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

async function loadPhotoBase64(filename: string): Promise<string | null> {
  if (!filename) return null;
  try {
    const buffer = await getPhotoBuffer(filename);
    if (buffer) {
      const ext = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      return `data:${ext};base64,${buffer.toString("base64")}`;
    }
  } catch {}
  return null;
}
