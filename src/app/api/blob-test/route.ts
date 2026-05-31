import { NextResponse } from "next/server";

// Diagnostic endpoint to test Vercel Blob Storage connection
// Access: /api/blob-test
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check environment
  results.hasVercelEnv = !!process.env.VERCEL;
  results.hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  results.blobTokenPrefix = process.env.BLOB_READ_WRITE_TOKEN
    ? process.env.BLOB_READ_WRITE_TOKEN.substring(0, 10) + "..."
    : "NOT SET";
  results.nodeEnv = process.env.NODE_ENV;

  // 2. Try to import @vercel/blob
  try {
    const blobModule = await import("@vercel/blob");
    results.blobImportSuccess = true;
    results.blobModuleKeys = Object.keys(blobModule);

    // 3. If token exists, try to list blobs
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const listResult = await blobModule.list({ limit: 5 });
        results.listSuccess = true;
        results.blobCount = listResult.blobs.length;
        results.blobs = listResult.blobs.map((b: { url: string; size: number; uploadedAt: Date }) => ({
          url: b.url,
          size: b.size,
          uploadedAt: b.uploadedAt,
        }));
        results.hasNextPage = listResult.hasMorePages || false;
      } catch (listErr) {
        results.listSuccess = false;
        results.listError = listErr instanceof Error ? listErr.message : String(listErr);
      }

      // 4. Try to write a test blob
      try {
        const testKey = `test/blob-test-${Date.now()}.txt`;
        const testContent = `Blob test at ${new Date().toISOString()}`;
        const putResult = await blobModule.put(testKey, testContent, {
          access: "public",
          contentType: "text/plain",
          allowOverwrite: true,
        });
        results.writeSuccess = true;
        results.writeUrl = putResult.url;

        // Clean up: delete test blob
        try {
          await blobModule.del(putResult.url);
          results.deleteSuccess = true;
        } catch (delErr) {
          results.deleteSuccess = false;
          results.deleteError = delErr instanceof Error ? delErr.message : String(delErr);
        }
      } catch (writeErr) {
        results.writeSuccess = false;
        results.writeError = writeErr instanceof Error ? writeErr.message : String(writeErr);
      }
    } else {
      results.listSuccess = false;
      results.listError = "BLOB_READ_WRITE_TOKEN not set";
      results.writeSuccess = false;
      results.writeError = "BLOB_READ_WRITE_TOKEN not set";
    }
  } catch (importErr) {
    results.blobImportSuccess = false;
    results.blobImportError = importErr instanceof Error ? importErr.message : String(importErr);
  }

  // 5. Try to read participants data
  try {
    const { getParticipants, initializeStorageIfNeeded } = await import("@/lib/storage");
    await initializeStorageIfNeeded();
    const participants = await getParticipants();
    results.participantsCount = participants.length;
    results.participantsReadSuccess = true;
  } catch (readErr) {
    results.participantsReadSuccess = false;
    results.participantsReadError = readErr instanceof Error ? readErr.message : String(readErr);
  }

  return NextResponse.json(results, { status: 200 });
}
