// Storage abstraction layer
// Supports both local filesystem (CSV/files) and Vercel Blob
// When BLOB_READ_WRITE_TOKEN is set, uses Vercel Blob
// When on Vercel without Blob, returns clear error
// Otherwise, falls back to local filesystem

export interface Participant {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}

const DATA_KEY = "data/participants.json";

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function isVercel(): boolean {
  return !!process.env.VERCEL;
}

// Error thrown when trying to write on Vercel without Blob
class VercelBlobRequiredError extends Error {
  constructor(action: string) {
    super(
      `${action} memerlukan Vercel Blob Storage. ` +
      `Buka Vercel Dashboard → Project → Storage → Create Blob → Link ke project → Redeploy. ` +
      `Setelah itu, fitur admin akan berfungsi penuh.`
    );
    this.name = "VercelBlobRequiredError";
  }
}

// Parse CSV text into Participant array
function parseCSV(csvText: string): Participant[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const result: Participant[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length >= headers.length) {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      result.push(obj as unknown as Participant);
    }
  }
  return result;
}

// Convert Participant array to CSV text
function toCSV(participantsList: Participant[]): string {
  const headers = [
    "sobat_id", "nama", "kecamatan", "gelombang",
    "tempat_pelatihan", "kelas", "photo_filename",
  ];
  const lines = [headers.join(",")];
  for (const p of participantsList) {
    lines.push([p.sobat_id, p.nama, p.kecamatan, p.gelombang, p.tempat_pelatihan, p.kelas, p.photo_filename].join(","));
  }
  return lines.join("\n");
}

// Get all participants from storage (read-only - works everywhere)
export async function getParticipants(): Promise<Participant[]> {
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(DATA_KEY);
      if (blobInfo) {
        const response = await fetch(blobInfo.url);
        if (response.ok) {
          return await response.json();
        }
      }
    } catch (error) {
      console.error("Error reading from Vercel Blob:", error);
    }
    const { participants } = await import("@/data/participants");
    return participants;
  }

  // Local filesystem mode (only works in local dev)
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const csvPath = join(process.cwd(), "upload", "data-peserta-se2026.csv");
    const csvText = readFileSync(csvPath, "utf-8");
    const result = parseCSV(csvText);
    if (result.length > 0) return result;
  } catch {
    // CSV not available
  }

  const { participants } = await import("@/data/participants");
  return participants;
}

// Save all participants to storage
export async function saveParticipants(participantsList: Participant[]): Promise<void> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(DATA_KEY, JSON.stringify(participantsList), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return;
  }

  // On Vercel without Blob - throw clear error
  if (isVercel()) {
    throw new VercelBlobRequiredError("Menyimpan data peserta");
  }

  // Local filesystem mode
  const { writeFileSync, existsSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const uploadDir = join(process.cwd(), "upload");
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  const csvPath = join(uploadDir, "data-peserta-se2026.csv");
  writeFileSync(csvPath, toCSV(participantsList), "utf-8");
}

// Upload a photo to storage - returns URL/path
export async function uploadPhoto(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`photos/${filename}`, buffer, {
      access: "public",
      contentType,
      allowOverwrite: true,
    });
    return blob.url;
  }

  // On Vercel without Blob - throw clear error
  if (isVercel()) {
    throw new VercelBlobRequiredError("Upload foto");
  }

  // Local filesystem mode
  const { writeFileSync, existsSync, mkdirSync } = await import("fs");
  const { join } = await import("path");

  const uploadDir = join(process.cwd(), "upload");
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  writeFileSync(join(uploadDir, filename), buffer);

  const publicPhotosDir = join(process.cwd(), "public", "photos");
  if (!existsSync(publicPhotosDir)) mkdirSync(publicPhotosDir, { recursive: true });
  writeFileSync(join(publicPhotosDir, filename), buffer);

  return `/api/photo?filename=${encodeURIComponent(filename)}`;
}

// Get photo URL for a participant
export async function getPhotoUrl(filename: string): Promise<string | null> {
  if (!filename) return null;
  if (filename.startsWith("http")) return filename;

  if (useBlob()) {
    try {
      const { list } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}` });
      if (blobs.blobs.length > 0) return blobs.blobs[0].url;
    } catch { /* fall through */ }
    return `/api/photo?filename=${encodeURIComponent(filename)}`;
  }

  try {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    if (existsSync(join(process.cwd(), "upload", filename))) {
      return `/api/photo?filename=${encodeURIComponent(filename)}`;
    }
    if (existsSync(join(process.cwd(), "public", "photos", filename))) {
      return `/api/photo?filename=${encodeURIComponent(filename)}`;
    }
  } catch { /* fall through */ }

  return `/api/photo?filename=${encodeURIComponent(filename)}`;
}

// Delete a photo from storage
export async function deletePhoto(filename: string): Promise<void> {
  if (!filename) return;
  if (useBlob()) {
    if (filename.startsWith("http")) {
      try { const { del } = await import("@vercel/blob"); await del(filename); } catch { /* ignore */ }
      return;
    }
    try {
      const { list, del } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}` });
      for (const blob of blobs.blobs) await del(blob.url);
    } catch { /* ignore */ }
    return;
  }

  // On Vercel without Blob - throw clear error
  if (isVercel()) {
    throw new VercelBlobRequiredError("Menghapus foto");
  }

  try {
    const { unlinkSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const uploadPath = join(process.cwd(), "upload", filename);
    if (existsSync(uploadPath)) unlinkSync(uploadPath);
    const publicPath = join(process.cwd(), "public", "photos", filename);
    if (existsSync(publicPath)) unlinkSync(publicPath);
  } catch { /* ignore */ }
}

export function isBlobMode(): boolean {
  return useBlob();
}

export function isVercelEnv(): boolean {
  return isVercel();
}

// Initialize storage with bundled data if empty (first Vercel deployment)
export async function initializeStorageIfNeeded(): Promise<void> {
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(DATA_KEY);
      if (!blobInfo) {
        const { participants } = await import("@/data/participants");
        await saveParticipants(participants);
      }
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  }
}
