// Storage abstraction layer for Vercel Blob + local filesystem
// Clean rewrite - no typos, no bugs

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

class VercelBlobRequiredError extends Error {
  constructor(action: string) {
    super(
      `${action} memerlukan Vercel Blob Storage. ` +
      `Buka Vercel Dashboard → Project → Storage → Create Blob → Link ke project → Redeploy.`
    );
    this.name = "VercelBlobRequiredError";
  }
}

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

function toCSV(list: Participant[]): string {
  const headers = ["sobat_id", "nama", "kecamatan", "gelombang", "tempat_pelatihan", "kelas", "photo_filename"];
  const lines = [headers.join(",")];
  for (const p of list) {
    lines.push(`${p.sobat_id},${p.nama},${p.kecamatan},${p.gelombang},${p.tempat_pelatihan},${p.kelas},${p.photo_filename}`);
  }
  return lines.join("\n");
}

export async function getParticipants(): Promise<Participant[]> {
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(DATA_KEY);
      if (blobInfo) {
        const response = await fetch(blobInfo.url);
        if (response.ok) return await response.json();
      }
    } catch (error) {
      console.error("Error reading from Vercel Blob:", error);
    }
    const { participants } = await import("@/data/participants");
    return participants;
  }

  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const csvPath = join(process.cwd(), "upload", "data-peserta-se2026.csv");
    const csvText = readFileSync(csvPath, "utf-8");
    const result = parseCSV(csvText);
    if (result.length > 0) return result;
  } catch {}

  const { participants } = await import("@/data/participants");
  return participants;
}

export async function saveParticipants(list: Participant[]): Promise<void> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(DATA_KEY, JSON.stringify(list), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return;
  }
  if (isVercel()) throw new VercelBlobRequiredError("Menyimpan data peserta");

  const { writeFileSync, existsSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const dir = join(process.cwd(), "upload");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "data-peserta-se2026.csv"), toCSV(list), "utf-8");
}

export async function uploadPhoto(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`photos/${filename}`, buffer, {
      access: "public",
      contentType,
      allowOverwrite: true,
    });
    return blob.url;
  }
  if (isVercel()) throw new VercelBlobRequiredError("Upload foto");

  const { writeFileSync, existsSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const uploadDir = join(process.cwd(), "upload");
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  writeFileSync(join(uploadDir, filename), buffer);
  const publicDir = join(process.cwd(), "public", "photos");
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, filename), buffer);
  return `/api/photo?filename=${encodeURIComponent(filename)}`;
}

export async function getPhotoUrl(filename: string): Promise<string | null> {
  if (!filename) return null;
  if (filename.startsWith("http")) return filename;

  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(`photos/${filename}`);
      if (blobInfo) return blobInfo.url;
    } catch {}
    try {
      const { list } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}`, limit: 1 });
      if (blobs.blobs.length > 0) return blobs.blobs[0].url;
    } catch {}
    return null;
  }

  try {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    if (existsSync(join(process.cwd(), "upload", filename))) {
      return `/api/photo?filename=${encodeURIComponent(filename)}`;
    }
  } catch {}

  return null;
}

// Get photo as Buffer - used by server-side nametag generation
export async function getPhotoBuffer(filename: string): Promise<Buffer | null> {
  if (!filename) return null;

  // If it's a URL, fetch it
  if (filename.startsWith("http")) {
    try {
      const res = await fetch(filename);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
    return null;
  }

  // Try Vercel Blob
  if (useBlob()) {
    const url = await getPhotoUrl(filename);
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {}
    }
    return null;
  }

  // Try local filesystem
  try {
    const { readFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const uploadPath = join(process.cwd(), "upload", filename);
    if (existsSync(uploadPath)) return readFileSync(uploadPath);
    const publicPath = join(process.cwd(), "public", "photos", filename);
    if (existsSync(publicPath)) return readFileSync(publicPath);
  } catch {}

  return null;
}

export async function deletePhoto(filename: string): Promise<void> {
  if (!filename) return;
  if (useBlob()) {
    if (filename.startsWith("http")) {
      try { const { del } = await import("@vercel/blob"); await del(filename); } catch {}
      return;
    }
    try {
      const { list, del } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}` });
      for (const blob of blobs.blobs) await del(blob.url);
    } catch {}
    return;
  }
  if (isVercel()) throw new VercelBlobRequiredError("Menghapus foto");
  try {
    const { unlinkSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const uploadPath = join(process.cwd(), "upload", filename);
    if (existsSync(uploadPath)) unlinkSync(uploadPath);
    const publicPath = join(process.cwd(), "public", "photos", filename);
    if (existsSync(publicPath)) unlinkSync(publicPath);
  } catch {}
}

export function isBlobMode(): boolean { return useBlob(); }
export function isVercelEnv(): boolean { return isVercel(); }

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
