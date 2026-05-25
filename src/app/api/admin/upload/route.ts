import { NextRequest, NextResponse } from "next/server";
import { getParticipants, saveParticipants, uploadPhoto, initializeStorageIfNeeded } from "@/lib/storage";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eykman04";

export async function POST(request: NextRequest) {
  const password = request.headers.get("x-admin-password");
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initializeStorageIfNeeded();

  try {
    const AdmZip = (await import("adm-zip")).default;
    const formData = await request.formData();
    const file = formData.get("zip") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File ZIP tidak ditemukan" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const extractedFiles: string[] = [];
    let csvData: string | null = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const filename = entry.entryName;

      if (filename.toLowerCase().endsWith(".csv")) {
        csvData = entry.getData().toString("utf-8");
        continue;
      }

      const ext = filename.split(".").pop()?.toLowerCase();
      if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
        const baseName = filename.split("/").pop() || filename;
        const contentType = getContentType(ext || "jpg");
        const imageBuffer = entry.getData();
        await uploadPhoto(baseName, imageBuffer, contentType);
        extractedFiles.push(baseName);
      }
    }

    if (csvData) {
      const newParticipants = parseCSV(csvData);
      if (newParticipants.length > 0) {
        const existingParticipants = await getParticipants();
        const existingIds = new Set(existingParticipants.map((p) => p.sobat_id.toLowerCase()));
        let addedCount = 0;

        for (const np of newParticipants) {
          if (!existingIds.has(np.sobat_id.toLowerCase())) {
            existingParticipants.push(np);
            existingIds.add(np.sobat_id.toLowerCase());
            addedCount++;
          } else {
            const idx = existingParticipants.findIndex(
              (p) => p.sobat_id.toLowerCase() === np.sobat_id.toLowerCase()
            );
            if (idx !== -1) existingParticipants[idx] = { ...existingParticipants[idx], ...np };
          }
        }

        await saveParticipants(existingParticipants);
        extractedFiles.push(`data-peserta-se2026.csv (${addedCount} baru, ${newParticipants.length - addedCount} diperbarui)`);
      }
    }

    if (extractedFiles.length === 0) {
      return NextResponse.json({ error: "Tidak ada file valid dalam ZIP. Sertakan CSV dan/atau foto." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: csvData
        ? `Berhasil mengekstrak ${extractedFiles.length} item. Data CSV diperbarui.`
        : `Berhasil mengekstrak ${extractedFiles.length} file foto.`,
      files: extractedFiles,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Gagal memproses ZIP: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
  return types[ext.toLowerCase()] || "image/jpeg";
}

function parseCSV(csvText: string) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length >= headers.length) {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => { obj[header] = values[index]; });
      result.push(obj);
    }
  }
  return result;
}
