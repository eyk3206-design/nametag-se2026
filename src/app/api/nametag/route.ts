import { NextRequest, NextResponse } from "next/server";
import { getParticipants, getPhotoBuffer } from "@/lib/storage";
import sharp from "sharp";
import QRCode from "qrcode";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Generate nametag PNG server-side using Sharp compositing
// This approach: render SVG (without photo) → composite photo on top
// Much more reliable than embedding large base64 photos in SVG
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
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": `inline; filename="nametag-${p.sobat_id}.png"`,
      },
    });
  } catch (error) {
    console.error("[Nametag] Generation error:", error);
    return new NextResponse(
      `Failed to generate nametag: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
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
  const SCALE = 3; // 3x for high quality
  const REAL_W = W * SCALE;
  const REAL_H = H * SCALE;

  // Step 1: Generate SVG template WITHOUT photo (photo area is placeholder)
  const svgBuffer = await generateSVGTEmplate(p, W, H);

  // Step 2: Render SVG to PNG at 3x scale
  let basePng = sharp(svgBuffer).resize(REAL_W, REAL_H, { fit: "fill" }).png();

  // Step 3: Try to load and composite the participant photo
  const photoBuffer = await getPhotoBuffer(p.photo_filename);
  if (photoBuffer) {
    try {
      // Photo area in original coords: x=40, y=92, w=120, h=140
      // At 3x scale: x=120, y=276, w=360, h=420
      const photoX = 40 * SCALE;
      const photoY = 92 * SCALE;
      const photoW = 120 * SCALE;
      const photoH = 140 * SCALE;
      const cornerRadius = 8 * SCALE;

      // Resize photo and add rounded corners using alpha mask
      const resizedPhoto = await sharp(photoBuffer)
        .resize(photoW, photoH, { fit: "cover" })
        .png()
        .toBuffer();

      // Create rounded rectangle mask for clipping
      const maskSvg = `<svg width="${photoW}" height="${photoH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${photoW}" height="${photoH}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
      </svg>`;
      const maskBuffer = await sharp(Buffer.from(maskSvg)).resize(photoW, photoH).png().toBuffer();

      // Apply mask to create rounded photo
      const roundedPhoto = await sharp(resizedPhoto)
        .composite([{ input: maskBuffer, blend: "dest-in" }])
        .png()
        .toBuffer();

      // Composite photo onto base nametag
      basePng = basePng.composite([{
        input: roundedPhoto,
        left: photoX,
        top: photoY,
      }]);

      console.log("[Nametag] Photo composited successfully for", p.sobat_id);
    } catch (photoErr) {
      console.error("[Nametag] Photo compositing failed for", p.sobat_id, photoErr);
      // Continue without photo - the SVG placeholder will show
    }
  } else {
    console.log("[Nametag] No photo found for", p.sobat_id, "- filename:", p.photo_filename);
  }

  return basePng.toBuffer();
}

async function generateSVGTEmplate(p: {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}, W: number, H: number): Promise<Buffer> {
  // Load logos as base64
  const logoBpsBase64 = loadLogoBase64("logo-bps.png");
  const logoSeBase64 = loadLogoBase64("logo-se.png");

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

  const esc = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const truncate = (str: string, max: number) => (str.length > max ? str.substring(0, max - 1) + "\u2026" : str);

  // Photo area is just a placeholder rectangle - photo will be composited by Sharp
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
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- Top bar -->
  <rect width="${W}" height="8" fill="url(#barGrad)"/>

  <!-- Bottom bar -->
  <rect y="${H - 8}" width="${W}" height="8" fill="url(#barGrad)"/>

  <!-- Header: Logo BPS -->
  <image href="${logoBpsBase64}" x="20" y="20" width="44" height="44"/>

  <!-- Header text -->
  <text x="300" y="34" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="#c2410c" letter-spacing="1">BADAN PUSAT STATISTIK</text>
  <text x="300" y="50" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#9a3412">Kabupaten Tasikmalaya</text>
  <line x1="252" y1="58" x2="276" y2="58" stroke="#f97316" stroke-width="2"/>
  <text x="300" y="62" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="#ea580c" letter-spacing="1.5">PELATIHAN PETUGAS SE2026</text>
  <line x1="324" y1="58" x2="348" y2="58" stroke="#f97316" stroke-width="2"/>

  <!-- Header: Logo SE -->
  <image href="${logoSeBase64}" x="536" y="20" width="44" height="44"/>

  <!-- Divider -->
  <rect x="0" y="76" width="${W}" height="3" fill="url(#divGrad)"/>

  <!-- Photo area placeholder (photo will be composited on top by Sharp) -->
  <rect x="40" y="92" width="120" height="140" rx="8" fill="#fff7ed" stroke="#fb923c" stroke-width="2"/>
  <!-- Placeholder avatar icon -->
  <circle cx="100" cy="145" r="25" fill="#FDBA74"/>
  <circle cx="100" cy="137" r="12" fill="#C2410C" opacity="0.3"/>
  <path d="M72 170 Q100 155 128 170 L128 210 Q100 220 72 210 Z" fill="#C2410C" opacity="0.3"/>
  <text x="100" y="225" text-anchor="middle" fill="#C2410C" font-size="10" font-family="Arial,sans-serif" font-weight="600">${esc(truncate(p.nama, 6).toUpperCase().substring(0, 2))}</text>

  <!-- QR Code -->
  <rect x="48" y="244" width="104" height="104" rx="6" fill="#fff" stroke="#fdba74" stroke-width="1"/>
  <image href="data:image/png;base64,${qrBase64}" x="54" y="250" width="92" height="92"/>

  <!-- Name box -->
  <rect x="176" y="92" width="404" height="50" rx="6" fill="#ea580c"/>
  <text x="190" y="110" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="500" fill="white" opacity="0.9" letter-spacing="1.5">NAMA</text>
  <text x="190" y="132" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="white">${esc(truncate(p.nama, 24))}</text>

  <!-- Sobat ID box -->
  <rect x="176" y="150" width="404" height="32" rx="6" fill="#ffedd5"/>
  <text x="190" y="170" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#9a3412" opacity="0.7" letter-spacing="1.5">SOBAT ID</text>
  <text x="280" y="171" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#9a3412">${esc(p.sobat_id)}</text>

  <!-- Info grid: Kecamatan -->
  <text x="190" y="204" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">KECAMATAN</text>
  <text x="190" y="218" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${esc(truncate(p.kecamatan, 20))}</text>

  <!-- Info grid: Gelombang -->
  <text x="390" y="204" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">GELOMBANG</text>
  <text x="390" y="218" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${esc(truncate(gel, 20))}</text>

  <!-- Info grid: Lokasi -->
  <text x="190" y="248" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">LOKASI</text>
  <text x="190" y="262" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${esc(truncate(p.tempat_pelatihan, 20))}</text>

  <!-- Info grid: Kelas -->
  <text x="390" y="248" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#9ca3af" letter-spacing="1">KELAS</text>
  <text x="390" y="262" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#1f2937">${esc(p.kelas)}</text>

  ${waktu ? `
  <!-- Waktu Pelatihan -->
  <rect x="176" y="280" width="404" height="38" rx="6" fill="#fff7ed" stroke="#fed7aa" stroke-width="1"/>
  <text x="190" y="298" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="600" fill="#ea580c" letter-spacing="1">WAKTU PELATIHAN</text>
  <text x="190" y="312" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#9a3412">${esc(truncate(waktu, 45))}</text>
  ` : ''}
</svg>`;

  return Buffer.from(svg);
}

function loadLogoBase64(filename: string): string {
  try {
    const filePath = join(process.cwd(), "public", filename);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {}
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}
