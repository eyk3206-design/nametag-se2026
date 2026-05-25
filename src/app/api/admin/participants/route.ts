import { NextRequest, NextResponse } from "next/server";
import { getParticipants, saveParticipants, deletePhoto, initializeStorageIfNeeded } from "@/lib/storage";
import type { Participant } from "@/lib/storage";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "eykman04";

function verifyPassword(request: NextRequest): boolean {
  return request.headers.get("x-admin-password") === ADMIN_PASSWORD;
}

// GET - List all participants
export async function GET(request: NextRequest) {
  if (!verifyPassword(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await initializeStorageIfNeeded();
    const participants = await getParticipants();
    return NextResponse.json({ participants });
  } catch {
    return NextResponse.json({ error: "Gagal membaca data" }, { status: 500 });
  }
}

// POST - Add or Update participant
export async function POST(request: NextRequest) {
  if (!verifyPassword(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await initializeStorageIfNeeded();
    const body = await request.json();
    const { action, participant } = body as { action: "add" | "edit"; participant: Participant };

    if (!participant?.sobat_id) return NextResponse.json({ error: "Data peserta tidak lengkap" }, { status: 400 });

    const participants = await getParticipants();

    if (action === "add") {
      if (participants.some((p) => p.sobat_id.toLowerCase() === participant.sobat_id.toLowerCase())) {
        return NextResponse.json({ error: `Sobat ID "${participant.sobat_id}" sudah ada` }, { status: 400 });
      }
      participants.push(participant);
    } else if (action === "edit") {
      const idx = participants.findIndex((p) => p.sobat_id.toLowerCase() === participant.sobat_id.toLowerCase());
      if (idx === -1) return NextResponse.json({ error: `Peserta "${participant.sobat_id}" tidak ditemukan` }, { status: 404 });
      participants[idx] = participant;
    } else {
      return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });
    }

    await saveParticipants(participants);
    return NextResponse.json({
      success: true,
      message: action === "add" ? "Peserta berhasil ditambahkan" : "Peserta berhasil diperbarui",
      participants,
    });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
  }
}

// DELETE - Remove participant
export async function DELETE(request: NextRequest) {
  if (!verifyPassword(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await initializeStorageIfNeeded();
    const { searchParams } = new URL(request.url);
    const sobatId = searchParams.get("sobat_id");
    if (!sobatId) return NextResponse.json({ error: "Sobat ID diperlukan" }, { status: 400 });

    let participants = await getParticipants();
    const target = participants.find((p) => p.sobat_id.toLowerCase() === sobatId.toLowerCase());
    if (!target) return NextResponse.json({ error: `Peserta "${sobatId}" tidak ditemukan` }, { status: 404 });

    if (target.photo_filename) await deletePhoto(target.photo_filename);

    participants = participants.filter((p) => p.sobat_id.toLowerCase() !== sobatId.toLowerCase());
    await saveParticipants(participants);
    return NextResponse.json({ success: true, message: `Peserta "${sobatId}" berhasil dihapus`, participants });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
