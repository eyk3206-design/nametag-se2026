import { NextRequest, NextResponse } from "next/server";
import { getParticipants, saveParticipants, uploadPhoto, initializeStorageIfNeeded } from "@/lib/storage";
import type { Participant } from "@/lib/storage";
import AdmZip from "adm-zip";
import sharp from "sharp";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eykman04";

// Sanitize participant data: ensure all fields are strings
function sanitize(p: any): Participant {
  return {
    sobat_id: String(p.sobat_id || ""),
    nama: String(p.nama || ""),
    kecamatan: String(p.kecamatan || ""),
    gelombang: String(p.gelombang || ""),
    tempat_pelatihan: String(p.tempat_pelatihan || ""),
    kelas: String(p.kelas || ""),
    photo_filename: String(p.photo_filename || ""),
  };
}

// Parse CSV text into Participant[]
function parseCSV(csvText: string): Participant[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter (comma or semicolon)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";

  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  const result: Participant[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    if (values.length < headers.length) continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || "";
    });

    // Try to map common column names
    const sobatId = obj.sobat_id || obj.sobatid || obj.id || obj.nik || "";
    const nama = obj.nama || obj.name || obj.nama_lengkap || "";
    const kecamatan = obj.kecamatan || obj.kec || "";
    const gelombang = obj.gelombang || obj.gel || "";
    const tempatPelatihan = obj.tempat_pelatihan || obj.tempatpelatihan || obj.lokasi || obj.tempat || "";
    const kelas = obj.kelas || obj.class || "";

    if (sobatId && nama) {
      result.push(sanitize({
        sobat_id: sobatId,
        nama,
        kecamatan,
        gelombang,
        tempat_pelatihan: tempatPelatihan,
        kelas,
        photo_filename: `${sobatId}.png`,
      }));
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  const password = request.headers.get("x-admin-password");
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initializeStorageIfNeeded();

    const formData = await request.formData();
    const file = formData.get("zip") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File ZIP tidak ditemukan" }, { status: 400 });
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: "File bukan format ZIP yang valid" }, { status: 400 });
    }

    const entries = zip.getEntries();
    const processedFiles: string[] = [];
    const errors: string[] = [];

    // 1. Process CSV files first (to get participant data)
    let newParticipants: Participant[] = [];
    const csvEntries = entries.filter(
      (e) => !e.isDirectory && (e.entryName.toLowerCase().endsWith(".csv") || e.entryName.toLowerCase().endsWith(".tsv"))
    );

    for (const csvEntry of csvEntries) {
      try {
        const csvText = csvEntry.getData().toString("utf-8");
        const parsed = parseCSV(csvText);
        if (parsed.length > 0) {
          newParticipants = [...newParticipants, ...parsed];
          processedFiles.push(`CSV: ${csvEntry.entryName} (${parsed.length} peserta)`);
        } else {
          errors.push(`CSV ${csvEntry.entryName}: Tidak ada data valid ditemukan`);
        }
      } catch (err) {
        errors.push(`CSV ${csvEntry.entryName}: Gagal membaca file`);
      }
    }

    // 2. Process photo files
    const imageEntries = entries.filter((e) => {
      if (e.isDirectory) return false;
      const ext = e.entryName.toLowerCase().split(".").pop() || "";
      return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
    });

    let photoCount = 0;
    for (const imgEntry of imageEntries) {
      try {
        const fileName = imgEntry.entryName.split("/").pop() || imgEntry.entryName;
        const baseName = fileName.replace(/\.[^.]+$/, "");

        // Convert to PNG and resize
        const imgBuffer = imgEntry.getData();
        const pngBuffer = await sharp(imgBuffer)
          .resize(600, 800, { fit: "inside", withoutEnlargement: true })
          .png({ quality: 90 })
          .toBuffer();

        const photoFilename = `${baseName}.png`;
        await uploadPhoto(photoFilename, pngBuffer, "image/png");
        photoCount++;
        processedFiles.push(`Foto: ${photoFilename}`);

        // If this photo's sobat_id doesn't exist in newParticipants, check existing data
        const existingParticipants = await getParticipants();
        const existingIdx = existingParticipants.findIndex(
          (p) => p.sobat_id.toLowerCase() === baseName.toLowerCase()
        );
        if (existingIdx >= 0 && !newParticipants.some((p) => p.sobat_id.toLowerCase() === baseName.toLowerCase())) {
          // Update photo_filename for existing participant
          existingParticipants[existingIdx].photo_filename = photoFilename;
          await saveParticipants(existingParticipants);
        }
      } catch (err) {
        errors.push(`Foto ${imgEntry.entryName}: Gagal memproses`);
      }
    }

    // 3. If we have new participants from CSV, merge them
    if (newParticipants.length > 0) {
      const existingParticipants = (await getParticipants()).map(sanitize);

      for (const np of newParticipants) {
        const idx = existingParticipants.findIndex(
          (p) => p.sobat_id.toLowerCase() === np.sobat_id.toLowerCase()
        );
        if (idx >= 0) {
          // Update existing - keep photo_filename if already has photo in ZIP
          const photoInZip = imageEntries.some((e) => {
            const baseName = (e.entryName.split("/").pop() || "").replace(/\.[^.]+$/, "");
            return baseName.toLowerCase() === np.sobat_id.toLowerCase();
          });
          existingParticipants[idx] = {
            ...np,
            photo_filename: photoInZip ? `${np.sobat_id}.png` : existingParticipants[idx].photo_filename,
          };
        } else {
          existingParticipants.push(np);
        }
      }

      await saveParticipants(existingParticipants);
    }

    // 4. If no CSV but photos only, just upload photos
    if (newParticipants.length === 0 && photoCount === 0) {
      return NextResponse.json(
        { error: "Tidak ada file CSV atau foto yang valid ditemukan dalam ZIP" },
        { status: 400 }
      );
    }

    const summary = [];
    if (newParticipants.length > 0) summary.push(`${newParticipants.length} data peserta`);
    if (photoCount > 0) summary.push(`${photoCount} foto`);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengunggah: ${summary.join(" dan ")}`,
      files: processedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("ZIP upload error:", error);
    return NextResponse.json(
      { error: `Gagal memproses file ZIP: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
