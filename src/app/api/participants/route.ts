import { NextResponse } from "next/server";
import { getParticipants, initializeStorageIfNeeded, Participant } from "@/lib/storage";

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

export async function GET(request: Request) {
  try {
    await initializeStorageIfNeeded();
    const { searchParams } = new URL(request.url);
    const sobatId = searchParams.get("sobat_id");
    const search = searchParams.get("search");

    const rawParticipants = await getParticipants();
    // Always sanitize to ensure consistent string types
    const participants = rawParticipants.map(sanitize);
    let filtered = [...participants];

    if (sobatId) {
      const sobatIdLower = sobatId.toLowerCase();
      filtered = filtered.filter((p) => p.sobat_id.toLowerCase() === sobatIdLower);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.sobat_id.toLowerCase().includes(searchLower) ||
          p.nama.toLowerCase().includes(searchLower) ||
          p.kecamatan.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ participants: filtered });
  } catch (error) {
    console.error("[API participants] Error:", error);
    return NextResponse.json({ error: "Gagal membaca data peserta" }, { status: 500 });
  }
}
