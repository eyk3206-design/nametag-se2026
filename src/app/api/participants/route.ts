import { NextResponse } from "next/server";
import { getParticipants, initializeStorageIfNeeded } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    await initializeStorageIfNeeded();
    const { searchParams } = new URL(request.url);
    const sobatId = searchParams.get("sobat_id");
    const search = searchParams.get("search");

    const participants = await getParticipants();
    let filtered = [...participants];

    if (sobatId) {
      filtered = filtered.filter((p) => p.sobat_id.toLowerCase() === sobatId.toLowerCase());
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
  } catch {
    return NextResponse.json({ error: "Gagal membaca data peserta" }, { status: 500 });
  }
}
