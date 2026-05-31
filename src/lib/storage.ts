// ============================================================
// Storage Abstraction Layer - 3 Modes
// ============================================================
// Mode 1: LOCAL_DATA_DIR (recommended for local/Google Drive Desktop)
//   Set LOCAL_DATA_DIR=G:\My Drive\2026_Project_1\db_se206
//   → Full CRUD, data stored on local filesystem
//   → Google Drive Desktop auto-syncs to cloud
//
// Mode 2: Vercel Blob (optional, for Vercel deployment)
//   Set BLOB_READ_WRITE_TOKEN=xxx (auto by Vercel when linked)
//   → Full CRUD, data stored in Vercel Blob Storage
//
// Mode 3: Read-only (default when no env vars set)
//   → Read-only, uses bundled default data
//   → Suitable for Vercel deployment without storage
// ============================================================

export interface Participant {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}

// === MODE DETECTION ===

function useLocalDataDir(): boolean {
  return !!process.env.LOCAL_DATA_DIR;
}

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isReadOnlyMode(): boolean {
  return !useLocalDataDir() && !useBlob();
}

export function isLocalDataDirMode(): boolean {
  return useLocalDataDir();
}

export function isBlobMode(): boolean {
  return useBlob();
}

export function isVercelEnv(): boolean {
  return !!process.env.VERCEL;
}

export function getStorageModeInfo(): {
  mode: string;
  label: string;
  description: string;
  writable: boolean;
  path?: string;
} {
  if (useLocalDataDir()) {
    return {
      mode: "local-data-dir",
      label: "Penyimpanan Lokal (Google Drive Desktop)",
      description: `Data disimpan di folder lokal yang tersinkronisasi dengan Google Drive. Semua fitur admin tersedia. Path: ${process.env.LOCAL_DATA_DIR}`,
      writable: true,
      path: process.env.LOCAL_DATA_DIR,
    };
  }
  if (useBlob()) {
    return {
      mode: "vercel-blob",
      label: "Vercel Blob Storage (Cloud)",
      description: "Data disimpan di Vercel Blob Storage. Semua fitur admin tersedia.",
      writable: true,
    };
  }
  return {
    mode: "read-only",
    label: "Mode Read-Only",
    description: "Data bawaan (read-only). Untuk fitur admin, jalankan aplikasi secara lokal dengan LOCAL_DATA_DIR atau aktifkan Vercel Blob.",
    writable: false,
  };
}

function getDataDir(): string {
  return process.env.LOCAL_DATA_DIR || "";
}

// === LOGGING ===

function logStorage(action: string, detail: string, error?: unknown) {
  const mode = useLocalDataDir() ? "LocalDir" : useBlob() ? "Blob" : "ReadOnly";
  const prefix = `[Storage:${mode}:${action}]`;
  if (error) {
    console.error(`${prefix} ${detail}`, error instanceof Error ? error.message : error);
  } else {
    console.log(`${prefix} ${detail}`);
  }
}

// === ERRORS ===

class ReadOnlyError extends Error {
  constructor(action: string) {
    super(
      `${action} tidak tersedia dalam mode read-only. ` +
      `Untuk fitur admin, set LOCAL_DATA_DIR di .env.local atau aktifkan Vercel Blob.`
    );
    this.name = "ReadOnlyError";
  }
}

// === HELPERS ===

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

// === PARTICIPANTS ===

export async function getParticipants(): Promise<Participant[]> {
  // Mode 1: LOCAL_DATA_DIR (Google Drive Desktop)
  if (useLocalDataDir()) {
    logStorage("getParticipants", `Reading from: ${getDataDir()}`);
    try {
      const fs = await import("fs");
      const path = await import("path");
      const jsonPath = path.join(getDataDir(), "participants.json");

      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        logStorage("getParticipants", `Loaded ${data.length} participants from local`);
        return data;
      }

      // Try CSV fallback (auto-convert to JSON)
      const csvPath = path.join(getDataDir(), "data-peserta-se2026.csv");
      if (fs.existsSync(csvPath)) {
        const csvText = fs.readFileSync(csvPath, "utf-8");
        const result = parseCSV(csvText);
        if (result.length > 0) {
          logStorage("getParticipants", `Loaded ${result.length} from CSV, auto-converting to JSON`);
          const dir = getDataDir();
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
          return result;
        }
      }

      // No data found locally, initialize with defaults
      logStorage("getParticipants", "No local data found, initializing with defaults");
      const { participants } = await import("@/data/participants");
      const dir = getDataDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const photosDir = path.join(dir, "photos");
      if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
      fs.writeFileSync(jsonPath, JSON.stringify(participants, null, 2), "utf-8");
      return participants;
    } catch (error) {
      logStorage("getParticipants", "Error reading LOCAL_DATA_DIR", error);
    }
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    logStorage("getParticipants", "Using Vercel Blob mode");
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head("data/participants.json");
      if (blobInfo) {
        logStorage("getParticipants", `Found data blob at ${blobInfo.url}`);
        const response = await fetch(blobInfo.url);
        if (response.ok) {
          const data = await response.json();
          logStorage("getParticipants", `Loaded ${Array.isArray(data) ? data.length : 0} participants from Blob`);
          return data;
        }
      }
    } catch (error) {
      logStorage("getParticipants", "Error reading from Blob", error);
    }
    const { participants } = await import("@/data/participants");
    logStorage("getParticipants", `Using default data: ${participants.length} participants`);
    return participants;
  }

  // Mode 3: Read-only (bundled default data)
  logStorage("getParticipants", "Read-only mode, using bundled default data");
  const { participants } = await import("@/data/participants");
  return participants;
}

export async function saveParticipants(list: Participant[]): Promise<void> {
  logStorage("saveParticipants", `Saving ${list.length} participants`);

  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dir = getDataDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const jsonPath = path.join(dir, "participants.json");
      fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), "utf-8");
      logStorage("saveParticipants", `Saved to: ${jsonPath}`);
      return;
    } catch (error) {
      logStorage("saveParticipants", "FAILED to save to LOCAL_DATA_DIR", error);
      throw error;
    }
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    try {
      const { put } = await import("@vercel/blob");
      const result = await put("data/participants.json", JSON.stringify(list), {
        access: "public",
        contentType: "application/json",
        allowOverwrite: true,
      });
      logStorage("saveParticipants", `Saved to Blob: ${result.url}`);
      return;
    } catch (error) {
      logStorage("saveParticipants", "FAILED to save to Blob", error);
      throw error;
    }
  }

  // Mode 3: Read-only
  throw new ReadOnlyError("Menyimpan data peserta");
}

// === PHOTOS ===

export async function uploadPhoto(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  logStorage("uploadPhoto", `Uploading ${filename} (${contentType}, ${buffer.length} bytes)`);

  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const photosDir = path.join(getDataDir(), "photos");
      if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

      // Delete old photos with same sobat_id but different extension
      const baseName = filename.replace(/\.[^.]+$/, "");
      const allExts = ["jpg", "jpeg", "png", "gif", "webp"];
      const newExt = filename.split(".").pop()?.toLowerCase() || "";
      for (const ext of allExts) {
        if (ext === newExt) continue;
        const oldPath = path.join(photosDir, `${baseName}.${ext}`);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          logStorage("uploadPhoto", `Deleted old photo: ${baseName}.${ext}`);
        }
      }

      const filePath = path.join(photosDir, filename);
      fs.writeFileSync(filePath, buffer);
      logStorage("uploadPhoto", `Saved to: ${filePath}`);
      return `/api/photo?filename=${encodeURIComponent(filename)}`;
    } catch (error) {
      logStorage("uploadPhoto", "FAILED to save photo locally", error);
      throw error;
    }
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`photos/${filename}`, buffer, {
        access: "public",
        contentType,
        allowOverwrite: true,
      });
      logStorage("uploadPhoto", `Uploaded to Blob: ${blob.url}`);
      return blob.url;
    } catch (error) {
      logStorage("uploadPhoto", "FAILED to upload to Blob", error);
      throw error;
    }
  }

  // Mode 3: Read-only
  throw new ReadOnlyError("Upload foto");
}

export async function getPhotoUrl(filename: string): Promise<string | null> {
  if (!filename) return null;
  if (filename.startsWith("http")) return filename;

  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(getDataDir(), "photos", filename);
      if (fs.existsSync(filePath)) {
        return `/api/photo?filename=${encodeURIComponent(filename)}`;
      }
      // Try alternate extensions
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const baseName = filename.replace(/\.[^.]+$/, "");
      const altExts = ["png", "jpg", "jpeg", "webp"].filter((e) => e !== ext);
      for (const altExt of altExts) {
        const altPath = path.join(getDataDir(), "photos", `${baseName}.${altExt}`);
        if (fs.existsSync(altPath)) {
          return `/api/photo?filename=${encodeURIComponent(`${baseName}.${altExt}`)}`;
        }
      }
    } catch {}
    // Also check public/photos/ for bundled photos
    try {
      const fs = await import("fs");
      const path = await import("path");
      const publicPath = path.join(process.cwd(), "public", "photos", filename);
      if (fs.existsSync(publicPath)) {
        return `/api/photo?filename=${encodeURIComponent(filename)}`;
      }
    } catch {}
    logStorage("getPhotoUrl", `Photo not found locally: ${filename}`);
    return null;
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(`photos/${filename}`);
      if (blobInfo) {
        logStorage("getPhotoUrl", `Found photo in Blob: ${filename}`);
        return blobInfo.url;
      }
    } catch {}
    try {
      const { list } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}`, limit: 1 });
      if (blobs.blobs.length > 0) {
        logStorage("getPhotoUrl", `Found photo via list: ${filename}`);
        return blobs.blobs[0].url;
      }
    } catch {}
    logStorage("getPhotoUrl", `Photo not found in Blob: ${filename}`);
    return null;
  }

  // Mode 3: Read-only - check public/photos/
  try {
    const fs = await import("fs");
    const path = await import("path");
    const publicPath = path.join(process.cwd(), "public", "photos", filename);
    if (fs.existsSync(publicPath)) {
      return `/api/photo?filename=${encodeURIComponent(filename)}`;
    }
  } catch {}

  return null;
}

export async function getPhotoBuffer(filename: string): Promise<Buffer | null> {
  if (!filename) return null;

  // If it's a full URL, fetch it directly
  if (filename.startsWith("http")) {
    logStorage("getPhotoBuffer", `Fetching from URL: ${filename.substring(0, 80)}...`);
    try {
      const res = await fetch(filename);
      if (res.ok) {
        logStorage("getPhotoBuffer", `Fetched ${res.headers.get("content-length") || "?"} bytes from URL`);
        return Buffer.from(await res.arrayBuffer());
      }
      logStorage("getPhotoBuffer", `URL fetch failed with status ${res.status}`);
    } catch (err) {
      logStorage("getPhotoBuffer", `URL fetch error`, err);
    }
    return null;
  }

  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    logStorage("getPhotoBuffer", `Reading from LOCAL_DATA_DIR: ${filename}`);
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(getDataDir(), "photos", filename);
      if (fs.existsSync(filePath)) {
        logStorage("getPhotoBuffer", `Found: ${filePath}`);
        return fs.readFileSync(filePath);
      }
      // Try alternate extensions
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const baseName = filename.replace(/\.[^.]+$/, "");
      const altExts = ["png", "jpg", "jpeg", "webp"].filter((e) => e !== ext);
      for (const altExt of altExts) {
        const altPath = path.join(getDataDir(), "photos", `${baseName}.${altExt}`);
        if (fs.existsSync(altPath)) {
          logStorage("getPhotoBuffer", `Found alt: ${baseName}.${altExt}`);
          return fs.readFileSync(altPath);
        }
      }
    } catch (error) {
      logStorage("getPhotoBuffer", "Error reading from LOCAL_DATA_DIR", error);
    }
    // Also try public/photos/ as fallback for bundled photos
    try {
      const fs = await import("fs");
      const path = await import("path");
      const publicPath = path.join(process.cwd(), "public", "photos", filename);
      if (fs.existsSync(publicPath)) {
        logStorage("getPhotoBuffer", `Found in public/photos/: ${filename}`);
        return fs.readFileSync(publicPath);
      }
    } catch {}
    logStorage("getPhotoBuffer", `Photo NOT found: ${filename}`);
    return null;
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    logStorage("getPhotoBuffer", `Looking in Blob: ${filename}`);
    // Method 1: Try head()
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(`photos/${filename}`);
      if (blobInfo) {
        logStorage("getPhotoBuffer", `Found via head(): ${blobInfo.url}`);
        const res = await fetch(blobInfo.url);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      logStorage("getPhotoBuffer", `head() failed`, err);
    }
    // Method 2: Try list() with prefix
    try {
      const { list } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}`, limit: 5 });
      if (blobs.blobs.length > 0) {
        logStorage("getPhotoBuffer", `Found ${blobs.blobs.length} blob(s) via list()`);
        const res = await fetch(blobs.blobs[0].url);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      logStorage("getPhotoBuffer", `list() failed`, err);
    }
    // Method 3: Try list() with name prefix
    try {
      const { list } = await import("@vercel/blob");
      const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
      const blobs = await list({ prefix: `photos/${nameWithoutExt}`, limit: 5 });
      if (blobs.blobs.length > 0) {
        logStorage("getPhotoBuffer", `Found via name prefix search: ${blobs.blobs[0].url}`);
        const res = await fetch(blobs.blobs[0].url);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      logStorage("getPhotoBuffer", `prefix list() failed`, err);
    }
    // Fallback: try local public/photos/
    try {
      const fs = await import("fs");
      const path = await import("path");
      const publicPath = path.join(process.cwd(), "public", "photos", filename);
      if (fs.existsSync(publicPath)) {
        logStorage("getPhotoBuffer", `Found in local public/photos/: ${filename}`);
        return fs.readFileSync(publicPath);
      }
    } catch {}
    logStorage("getPhotoBuffer", `Photo NOT found in Blob: ${filename}`);
    return null;
  }

  // Mode 3: Read-only - check public/photos/
  logStorage("getPhotoBuffer", `Read-only mode, checking public/photos/: ${filename}`);
  try {
    const fs = await import("fs");
    const path = await import("path");
    const publicPath = path.join(process.cwd(), "public", "photos", filename);
    if (fs.existsSync(publicPath)) return fs.readFileSync(publicPath);
  } catch {}

  return null;
}

export async function deletePhoto(filename: string): Promise<void> {
  if (!filename) return;

  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(getDataDir(), "photos", filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      logStorage("deletePhoto", `Deleted: ${filePath}`);
    } catch (error) {
      logStorage("deletePhoto", `Failed to delete ${filename}`, error);
    }
    return;
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    if (filename.startsWith("http")) {
      try {
        const { del } = await import("@vercel/blob");
        await del(filename);
      } catch {}
      return;
    }
    try {
      const { list, del } = await import("@vercel/blob");
      const blobs = await list({ prefix: `photos/${filename}` });
      for (const blob of blobs.blobs) await del(blob.url);
      logStorage("deletePhoto", `Deleted ${blobs.blobs.length} blob(s) for ${filename}`);
    } catch (error) {
      logStorage("deletePhoto", `Failed to delete ${filename}`, error);
    }
    return;
  }

  // Mode 3: Read-only
  throw new ReadOnlyError("Menghapus foto");
}

// === INITIALIZATION ===

export async function initializeStorageIfNeeded(): Promise<void> {
  // Mode 1: LOCAL_DATA_DIR
  if (useLocalDataDir()) {
    logStorage("init", `Initializing LOCAL_DATA_DIR: ${getDataDir()}`);
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dir = getDataDir();

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logStorage("init", `Created directory: ${dir}`);
      }

      const photosDir = path.join(dir, "photos");
      if (!fs.existsSync(photosDir)) {
        fs.mkdirSync(photosDir, { recursive: true });
        logStorage("init", `Created photos directory: ${photosDir}`);
      }

      const jsonPath = path.join(dir, "participants.json");
      if (!fs.existsSync(jsonPath)) {
        const { participants } = await import("@/data/participants");
        fs.writeFileSync(jsonPath, JSON.stringify(participants, null, 2), "utf-8");
        logStorage("init", `Created participants.json with ${participants.length} default entries`);
      } else {
        logStorage("init", "Existing participants.json found, skipping initialization");
      }
    } catch (error) {
      logStorage("init", "Error initializing LOCAL_DATA_DIR", error);
    }
    return;
  }

  // Mode 2: Vercel Blob
  if (useBlob()) {
    logStorage("init", "Initializing Vercel Blob storage...");
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head("data/participants.json");
      if (!blobInfo) {
        logStorage("init", "No existing data found in Blob, uploading defaults...");
        const { participants } = await import("@/data/participants");
        await saveParticipants(participants);
        logStorage("init", `Initialized Blob with ${participants.length} default participants`);
      } else {
        logStorage("init", "Existing data blob found, skipping initialization");
      }
    } catch (error) {
      logStorage("init", "Error initializing Blob storage", error);
    }
    return;
  }

  // Mode 3: Read-only
  logStorage("init", "Read-only mode, no initialization needed");
}
