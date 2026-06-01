"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search, Loader2, Shield, Upload, Lock, X, CheckCircle,
  AlertCircle, Pencil, Trash2, Plus, Cloud, Users, HardDrive, Minimize, Filter,
} from "lucide-react";

interface Participant {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}

const emptyParticipant: Participant = {
  sobat_id: "", nama: "", kecamatan: "", gelombang: "",
  tempat_pelatihan: "", kelas: "", photo_filename: "",
};

export default function Home() {
  const [sobatId, setSobatId] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [notFound, setNotFound] = useState(false);
  const [showSearchHint, setShowSearchHint] = useState(false);

  // Storage status
  const [storageStatus, setStorageStatus] = useState<{mode: string; label: string; description: string; writable: boolean; path?: string; blobMode: boolean; localDataDir: boolean} | null>(null);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminTab, setAdminTab] = useState<"upload" | "manage">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{success: boolean; message: string; files?: string[]} | null>(null);

  // Manage state
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilterKelas, setAdminFilterKelas] = useState("");
  const [adminFilterGelombang, setAdminFilterGelombang] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [saving, setSaving] = useState(false);
  const [formResult, setFormResult] = useState<{success: boolean; message: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fullscreen photo+QR mode for mobile
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const enterFullscreen = useCallback(async () => {
    setFullscreenMode(true);
    // Use native Fullscreen API
    await new Promise((r) => setTimeout(r, 50)); // wait for DOM render
    try {
      const el = fullscreenRef.current;
      if (el) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        else if ((el as any).msRequestFullscreen) (el as any).msRequestFullscreen();
      }
    } catch {
      // Fullscreen not supported or denied - overlay still shows
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setFullscreenMode(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } catch {}
  }, []);

  // Sync fullscreen state when user exits via browser UI (Esc, back)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setFullscreenMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // === SEARCH ===
  const handleSearch = useCallback(async () => {
    if (!sobatId.trim()) return;
    setIsLoading(true);
    setNotFound(false);
    setSelectedParticipant(null);

    try {
      const res = await fetch(`/api/participants?sobat_id=${encodeURIComponent(sobatId.trim())}`);
      const data = await res.json();
      const participants: Participant[] = data.participants || [];
      if (participants.length > 0) {
        setSelectedParticipant(participants[0]);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [sobatId]);

  // === ADMIN ===
  const handleAdminLogin = () => {
    if (adminPassword === "eykman04") {
      setAdminAuthenticated(true);
      setUploadResult(null);
      loadAllParticipants();
      checkStorageStatus();
    }
  };

  const checkStorageStatus = async () => {
    try {
      const res = await fetch("/api/storage-status");
      const data = await res.json();
      setStorageStatus(data);
    } catch { setStorageStatus(null); }
  };

  const loadAllParticipants = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/participants", { headers: { "x-admin-password": adminPassword } });
      const data = await res.json();
      if (res.ok) setAllParticipants(data.participants || []);
    } catch { setAllParticipants([]); }
    finally { setLoadingData(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("zip", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-password": adminPassword },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadResult({ success: true, message: data.message, files: data.files });
        loadAllParticipants();
      } else {
        setUploadResult({ success: false, message: data.error || "Upload gagal" });
      }
    } catch {
      setUploadResult({ success: false, message: "Gagal mengunggah file" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFormPhotoFile(file);
    setFormResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setFormPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    const ext = file.name.split(".").pop() || "jpg";
    if (editParticipant) {
      setEditParticipant({ ...editParticipant, photo_filename: `${editParticipant.sobat_id || "SOBAT"}.${ext}` });
    }
  };

  const handleSaveParticipant = async () => {
    if (!editParticipant?.sobat_id || !editParticipant?.nama) {
      setFormResult({ success: false, message: "Sobat ID dan Nama wajib diisi" });
      return;
    }
    if (!editParticipant.photo_filename) editParticipant.photo_filename = `${editParticipant.sobat_id}.jpg`;
    setSaving(true);
    setFormResult(null);
    try {
      if (formPhotoFile) {
        setUploadingPhoto(true);
        const photoFormData = new FormData();
        photoFormData.append("photo", formPhotoFile);
        photoFormData.append("sobat_id", editParticipant.sobat_id);
        const photoRes = await fetch("/api/admin/photo", {
          method: "POST", headers: { "x-admin-password": adminPassword }, body: photoFormData,
        });
        const photoData = await photoRes.json();
        setUploadingPhoto(false);
        if (photoRes.ok && photoData.filename) editParticipant.photo_filename = photoData.filename;
      }
      const res = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ action: formMode, participant: editParticipant }),
      });
      const data = await res.json();
      if (res.ok) {
        setFormResult({ success: true, message: data.message });
        setAllParticipants(data.participants || []);
        setShowForm(false);
        setEditParticipant(null);
        setFormPhotoFile(null);
        setFormPhotoPreview(null);
        setTimeout(() => setFormResult(null), 3000);
      } else {
        setFormResult({ success: false, message: data.error || "Gagal menyimpan" });
      }
    } catch {
      setFormResult({ success: false, message: "Gagal menyimpan data" });
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/participants?sobat_id=${encodeURIComponent(id)}`, {
        method: "DELETE", headers: { "x-admin-password": adminPassword },
      });
      const data = await res.json();
      if (res.ok) { setAllParticipants(data.participants || []); setDeleteConfirm(null); }
    } catch {} finally { setSaving(false); }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const parseGelombang = (gelombang: string) => {
    const parts = gelombang.split(" - ");
    return { gel: parts[0]?.trim() || gelombang, waktu: parts[1]?.trim() || "" };
  };

  const getPhotoUrl = (filename: string) => {
    if (!filename) return null;
    if (filename.startsWith("http")) return filename;
    // Add timestamp to prevent browser caching old photos
    return `/api/photo?filename=${encodeURIComponent(filename)}&_t=${Date.now()}`;
  };

  // Admin search & filter logic
  const filteredParticipants = allParticipants.filter((p) => {
    // Search filter (multi-column)
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase().trim();
      const match =
        p.sobat_id.toLowerCase().includes(q) ||
        p.nama.toLowerCase().includes(q) ||
        p.kecamatan.toLowerCase().includes(q) ||
        p.tempat_pelatihan.toLowerCase().includes(q) ||
        p.kelas.toLowerCase().includes(q) ||
        p.gelombang.toLowerCase().includes(q);
      if (!match) return false;
    }
    // Kelas filter
    if (adminFilterKelas && p.kelas !== adminFilterKelas) return false;
    // Gelombang filter
    if (adminFilterGelombang && p.gelombang.split(" - ")[0]?.trim() !== adminFilterGelombang) return false;
    return true;
  });

  // Get unique Kelas and Gelombang for filter dropdowns
  const uniqueKelas = [...new Set(allParticipants.map((p) => p.kelas))].sort();
  const uniqueGelombang = [...new Set(allParticipants.map((p) => p.gelombang.split(" - ")[0]?.trim() || p.gelombang))].sort();

  // Photo URL for nametag display
  const [displayPhotoUrl, setDisplayPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedParticipant?.photo_filename) {
      const url = getPhotoUrl(selectedParticipant.photo_filename);
      setDisplayPhotoUrl(url);
    } else {
      setDisplayPhotoUrl(null);
    }
  }, [selectedParticipant]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            <img src="/logo-bps.png" alt="Logo BPS" className="h-14 w-14 object-contain bg-white rounded-full p-1" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Pelatihan Petugas SE2026</h1>
              <p className="text-orange-100 text-sm md:text-base">BPS Kabupaten Tasikmalaya</p>
            </div>
            <img src="/logo-se.png" alt="Logo SE" className="h-14 w-14 object-contain bg-white rounded-full p-1 shrink-0" />

            {/* Admin Button */}
            <Dialog open={adminOpen} onOpenChange={(open) => {
              setAdminOpen(open);
              if (!open) {
                setAdminAuthenticated(false);
                setAdminPassword("");
                setUploadResult(null);
                setShowForm(false);
                setEditParticipant(null);
                setFormResult(null);
                setDeleteConfirm(null);
                setFormPhotoFile(null);
                setFormPhotoPreview(null);
                setAdminSearch("");
                setAdminFilterKelas("");
                setAdminFilterGelombang("");
                if (selectedParticipant && sobatId) handleSearch();
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white gap-2 ml-2 shrink-0">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-orange-800">
                    <Shield className="h-5 w-5" />Panel Admin
                  </DialogTitle>
                </DialogHeader>

                {!adminAuthenticated ? (
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-600">Masukkan password admin untuk mengakses fitur pengelolaan data.</p>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                      <Input type="password" placeholder="Password admin..." value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                        className="pl-10 border-orange-200 focus:border-orange-500" />
                    </div>
                    <Button onClick={handleAdminLogin} className="w-full bg-orange-600 hover:bg-orange-700 text-white">Masuk</Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {/* Storage status */}
                    {storageStatus?.mode === "local-data-dir" ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-start gap-2">
                        <HardDrive className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800">Penyimpanan Lokal (Google Drive Desktop)</p>
                          <p className="text-xs text-emerald-700">Data tersimpan di: <code className="bg-emerald-100 px-1 rounded text-[10px]">{storageStatus.path}</code></p>
                          <p className="text-xs text-emerald-600 mt-0.5">Semua fitur admin tersedia. Data otomatis tersinkronisasi ke Google Drive.</p>
                        </div>
                      </div>
                    ) : storageStatus?.mode === "vercel-blob" ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <Cloud className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">Vercel Blob Storage (Cloud)</p>
                          <p className="text-xs text-blue-700">Data peserta dan foto disimpan di Vercel Blob. Semua fitur admin tersedia.</p>
                        </div>
                      </div>
                    ) : storageStatus?.mode === "read-only" ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">Mode Read-Only</p>
                          <p className="text-xs text-amber-700">Fitur admin tidak tersedia dalam mode read-only. Untuk mengelola data, jalankan aplikasi secara lokal dengan LOCAL_DATA_DIR atau aktifkan Vercel Blob Storage.</p>
                        </div>
                      </div>
                    ) : null}

                    {/* Read-only mode: disable admin features */}
                    {storageStatus?.mode === "read-only" ? (
                      <div className="py-4 text-center">
                        <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-amber-800 mb-1">Fitur Admin Tidak Tersedia</p>
                        <p className="text-xs text-amber-700 max-w-md mx-auto">Aplikasi berjalan dalam mode read-only. Untuk mengelola data peserta, jalankan aplikasi secara lokal dengan menambahkan <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono">LOCAL_DATA_DIR</code> di file <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono">.env.local</code></p>
                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-left max-w-md mx-auto">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">Contoh .env.local:</p>
                          <code className="text-[10px] text-gray-800 font-mono">LOCAL_DATA_DIR=G:\My Drive\2026_Project_1\db_se206</code>
                        </div>
                      </div>
                    ) : (<>
                    {/* Tabs */}
                    <div className="flex border-b border-orange-200">
                      <button onClick={() => setAdminTab("upload")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${adminTab === "upload" ? "border-orange-600 text-orange-700" : "border-transparent text-gray-500 hover:text-orange-600"}`}>
                        <Upload className="h-4 w-4 inline mr-1.5" />Upload ZIP
                      </button>
                      <button onClick={() => { setAdminTab("manage"); loadAllParticipants(); }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${adminTab === "manage" ? "border-orange-600 text-orange-700" : "border-transparent text-gray-500 hover:text-orange-600"}`}>
                        <Users className="h-4 w-4 inline mr-1.5" />Kelola Data Peserta
                      </button>
                    </div>

                    {/* Upload Tab */}
                    {adminTab === "upload" && (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center bg-orange-50/50">
                          <Upload className="h-10 w-10 text-orange-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-orange-800 mb-1">Upload File ZIP</p>
                          <p className="text-xs text-gray-500 mb-3">File ZIP berisi foto peserta (.jpg/.png) dan/atau data CSV</p>
                          <label className="inline-flex items-center gap-2 cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Mengunggah...</> : <><Upload className="h-4 w-4" />Pilih File ZIP</>}
                            <input type="file" accept=".zip" onChange={handleUpload} className="hidden" disabled={uploading} />
                          </label>
                        </div>
                        {uploadResult && (
                          <div className={`rounded-lg p-3 flex items-start gap-2 ${uploadResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                            {uploadResult.success ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${uploadResult.success ? "text-green-800" : "text-red-800"}`}>{uploadResult.message}</p>
                              {uploadResult.files && uploadResult.files.length > 0 && (
                                <div className="mt-1 max-h-24 overflow-y-auto">
                                  {uploadResult.files.map((f, i) => <p key={i} className="text-xs text-gray-600 truncate">{f}</p>)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manage Tab */}
                    {adminTab === "manage" && (
                      <div className="space-y-4">
                        {/* Search & Filter Bar */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                              <Input
                                placeholder="Cari Sobat ID, Nama, Kecamatan..."
                                value={adminSearch}
                                onChange={(e) => setAdminSearch(e.target.value)}
                                className="pl-10 border-orange-200 focus:border-orange-500 h-9 text-sm"
                              />
                              {adminSearch && (
                                <button onClick={() => setAdminSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-orange-100 rounded">
                                  <X className="h-3.5 w-3.5 text-gray-400" />
                                </button>
                              )}
                            </div>
                            <Button onClick={() => { setFormMode("add"); setEditParticipant({ ...emptyParticipant }); setShowForm(true); setFormResult(null); setFormPhotoFile(null); setFormPhotoPreview(null); }}
                              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-sm h-9 shrink-0">
                              <Plus className="h-4 w-4" />Tambah
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-orange-400 shrink-0" />
                            <select
                              value={adminFilterGelombang}
                              onChange={(e) => setAdminFilterGelombang(e.target.value)}
                              className="h-8 text-xs border border-orange-200 rounded-md px-2 bg-white focus:border-orange-500 focus:outline-none"
                            >
                              <option value="">Semua Gelombang</option>
                              {uniqueGelombang.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            <select
                              value={adminFilterKelas}
                              onChange={(e) => setAdminFilterKelas(e.target.value)}
                              className="h-8 text-xs border border-orange-200 rounded-md px-2 bg-white focus:border-orange-500 focus:outline-none"
                            >
                              <option value="">Semua Kelas</option>
                              {uniqueKelas.map((k) => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                            {(adminSearch || adminFilterKelas || adminFilterGelombang) && (
                              <button
                                onClick={() => { setAdminSearch(""); setAdminFilterKelas(""); setAdminFilterGelombang(""); }}
                                className="h-8 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2 rounded-md transition-colors"
                              >
                                Reset Filter
                              </button>
                            )}
                            <span className="text-xs text-gray-500 ml-auto">
                              {filteredParticipants.length} dari {allParticipants.length} peserta
                            </span>
                          </div>
                        </div>

                        {showForm && editParticipant && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                            <p className="text-sm font-semibold text-orange-800">{formMode === "add" ? "Tambah Peserta Baru" : `Edit: ${editParticipant.sobat_id}`}</p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: "Sobat ID *", key: "sobat_id", placeholder: "SOBAT007", uppercase: true, disabled: formMode === "edit" },
                                { label: "Nama *", key: "nama", placeholder: "Nama Lengkap" },
                                { label: "Kecamatan", key: "kecamatan", placeholder: "Nama Kecamatan" },
                                { label: "Gelombang", key: "gelombang", placeholder: "Gelombang 1 - 15 Januari 2026" },
                                { label: "Lokasi Pelatihan", key: "tempat_pelatihan", placeholder: "Hotel Grand Tasikmalaya" },
                                { label: "Kelas", key: "kelas", placeholder: "Kelas A" },
                              ].map((field) => (
                                <div key={field.key}>
                                  <Label className="text-xs text-gray-600">{field.label}</Label>
                                  <Input value={(editParticipant as any)[field.key]}
                                    onChange={(e) => setEditParticipant({ ...editParticipant, [field.key]: field.uppercase ? e.target.value.toUpperCase() : e.target.value })}
                                    disabled={field.disabled} placeholder={field.placeholder} className="h-9 text-sm" />
                                </div>
                              ))}
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-600">Foto Peserta</Label>
                                <div className="flex items-start gap-3 mt-1">
                                  <div className="w-20 h-24 border-2 border-dashed border-orange-300 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                                    {formPhotoPreview ? <img src={formPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                                      : editParticipant.photo_filename && formMode === "edit" ? <img src={getPhotoUrl(editParticipant.photo_filename) || ""} alt="Foto" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      : <div className="text-center text-orange-400"><Upload className="h-5 w-5 mx-auto" /><span className="text-[9px]">Foto</span></div>}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                                      {uploadingPhoto ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengunggah...</> : <><Upload className="h-3.5 w-3.5" />Pilih Foto</>}
                                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploadingPhoto} />
                                    </label>
                                    <p className="text-[10px] text-gray-400">Format: JPG, PNG, GIF, WebP. Maks 5MB.</p>
                                    {editParticipant.photo_filename && <p className="text-[10px] text-gray-500">File: {editParticipant.photo_filename}</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {formResult && (
                              <div className={`rounded p-2 flex items-center gap-2 text-sm ${formResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {formResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                                {formResult.message}
                              </div>
                            )}
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => { setShowForm(false); setEditParticipant(null); setFormResult(null); }} className="text-sm h-8">Batal</Button>
                              <Button onClick={handleSaveParticipant} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white text-sm h-8 gap-1.5">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                {saving ? "Menyimpan..." : "Simpan"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {loadingData ? (
                          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 text-orange-500 animate-spin" /><span className="ml-2 text-sm text-gray-500">Memuat data...</span></div>
                        ) : (
                          <div className="border border-orange-200 rounded-lg overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-orange-100 sticky top-0">
                                  <tr>
                                    <th className="text-left px-3 py-2 text-orange-800 font-semibold">Sobat ID</th>
                                    <th className="text-left px-3 py-2 text-orange-800 font-semibold">Nama</th>
                                    <th className="text-left px-3 py-2 text-orange-800 font-semibold hidden md:table-cell">Kecamatan</th>
                                    <th className="text-left px-3 py-2 text-orange-800 font-semibold hidden md:table-cell">Kelas</th>
                                    <th className="text-center px-3 py-2 text-orange-800 font-semibold w-20">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredParticipants.map((p, idx) => (
                                    <tr key={p.sobat_id} className={`border-t border-orange-100 ${idx % 2 === 0 ? "bg-white" : "bg-orange-50/30"}`}>
                                      <td className="px-3 py-2 font-mono text-xs font-semibold text-orange-700">{p.sobat_id}</td>
                                      <td className="px-3 py-2 text-gray-800 truncate max-w-[150px]">{p.nama}</td>
                                      <td className="px-3 py-2 text-gray-600 truncate max-w-[100px] hidden md:table-cell">{p.kecamatan}</td>
                                      <td className="px-3 py-2 text-gray-600 hidden md:table-cell">{p.kelas}</td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <button onClick={() => { setFormMode("edit"); setEditParticipant({ ...p }); setShowForm(true); setFormResult(null); setFormPhotoFile(null); setFormPhotoPreview(null); }}
                                            className="p-1.5 rounded-md hover:bg-orange-100 text-orange-600 transition-colors" title="Edit">
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          {deleteConfirm === p.sobat_id ? (
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => handleDeleteParticipant(p.sobat_id)} className="p-1 rounded-md bg-red-500 text-white hover:bg-red-600" title="Konfirmasi"><CheckCircle className="h-3.5 w-3.5" /></button>
                                              <button onClick={() => setDeleteConfirm(null)} className="p-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300" title="Batal"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                          ) : (
                                            <button onClick={() => setDeleteConfirm(p.sobat_id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {allParticipants.length === 0 && (
                                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Belum ada data peserta</td></tr>
                                  )}
                                  {allParticipants.length > 0 && filteredParticipants.length === 0 && (
                                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Tidak ada peserta yang cocok dengan pencarian</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    </>)}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1">
        {/* Search */}
        <Card className="mb-8 border-orange-200 shadow-md">
          <CardHeader className="bg-orange-50 border-b border-orange-100">
            <CardTitle className="text-orange-800 flex items-center gap-2"><Search className="h-5 w-5" />Cari Data Peserta</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                <Input placeholder="Masukkan Sobat ID" value={sobatId}
                  onChange={(e) => { setSobatId(e.target.value); setNotFound(false); }}
                  onFocus={() => setShowSearchHint(true)} onBlur={() => setShowSearchHint(false)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 border-orange-200 focus:border-orange-500 text-base h-12 uppercase" />
                {showSearchHint && !sobatId && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                    <p className="text-sm text-blue-700">Sobat ID dapat dilihat pada <a href="https://mitra.bps.go.id/beranda" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-blue-900">www.mitra.bps.go.id</a></p>
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} disabled={isLoading || !sobatId.trim()} className="bg-orange-600 hover:bg-orange-700 text-white px-6 h-12 text-base font-semibold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cari"}
              </Button>
            </div>
            {notFound && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">Peserta dengan Sobat ID <strong>&quot;{sobatId}&quot;</strong> tidak ditemukan.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fullscreen Photo + QR Mode (mobile only) */}
        {fullscreenMode && selectedParticipant && (
          <div
            ref={fullscreenRef}
            className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center md:hidden"
            onClick={exitFullscreen}
            style={{ cursor: "pointer" }}
          >
            {/* Close button */}
            <button
              onClick={exitFullscreen}
              className="absolute top-4 right-4 z-20 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors"
            >
              <Minimize className="h-5 w-5" />
            </button>

            {/* Photo - top */}
            <div
              style={{
                width: "min(80vw, 320px)",
                aspectRatio: "3/4",
                border: "3px solid #f97316",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#fff7ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              {displayPhotoUrl ? (
                <img src={displayPhotoUrl} alt={selectedParticipant.nama} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#ea580c" }}>
                  <span style={{ fontSize: "64px", lineHeight: 1 }}>&#128100;</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, marginTop: "8px" }}>{getInitials(selectedParticipant.nama)}</span>
                </div>
              )}
            </div>

            {/* QR Code - bottom */}
            <div style={{
              background: "#fff",
              padding: "12px",
              border: "2px solid #fdba74",
              borderRadius: "12px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}>
              <QRCodeSVG value={selectedParticipant.sobat_id} size={160} level="M" fgColor="#c2410c" bgColor="#ffffff" />
            </div>

            {/* Hint */}
            <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-400 px-6">Screen Shoot layar ini untuk di tunjukan ke Panitia Pelatihan.</p>
          </div>
        )}

        {/* Nametag Display */}
        {selectedParticipant && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-orange-800">Klik Nametag dan Perlihatkan kepada Panitia</h2>
            </div>

            <div className="flex justify-center">
              <div
                className="relative bg-white border-2 border-orange-400 overflow-hidden md:cursor-default cursor-pointer select-none"
                style={{ width: "600px", height: "380px", fontFamily: "Arial, sans-serif", WebkitUserSelect: "none" }}
                onClick={() => { if (window.innerWidth < 768) enterFullscreen(); }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", background: "linear-gradient(to right, #ea580c, #f97316, #fb923c)" }} />
                <div style={{ padding: "14px 20px 16px", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "10px" }}>
                    <img src="/logo-bps.png" alt="BPS" style={{ height: "44px", width: "44px", objectFit: "contain" }} />
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "#c2410c", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", margin: 0 }}>Badan Pusat Statistik</p>
                      <p style={{ color: "#9a3412", fontSize: "13px", fontWeight: 700, margin: "2px 0" }}>Kabupaten Tasikmalaya</p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <div style={{ height: "2px", width: "24px", background: "#f97316" }} />
                        <p style={{ color: "#ea580c", fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", margin: 0 }}>Pelatihan Petugas SE2026</p>
                        <div style={{ height: "2px", width: "24px", background: "#f97316" }} />
                      </div>
                    </div>
                    <img src="/logo-se.png" alt="SE2026" style={{ height: "44px", width: "44px", objectFit: "contain" }} />
                  </div>
                  <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #f97316, transparent)", marginBottom: "12px" }} />
                  <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <div style={{ width: "120px", height: "140px", border: "2px solid #fb923c", borderRadius: "8px", overflow: "hidden", background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {displayPhotoUrl ? <img src={displayPhotoUrl} alt={selectedParticipant.nama} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#ea580c" }}><span style={{ fontSize: "36px", lineHeight: 1 }}>&#128100;</span><span style={{ fontSize: "10px", fontWeight: 600, marginTop: "4px" }}>{getInitials(selectedParticipant.nama)}</span></div>}
                      </div>
                      <div style={{ background: "#fff", padding: "6px", border: "1px solid #fdba74", borderRadius: "6px" }}>
                        <QRCodeSVG value={selectedParticipant.sobat_id} size={72} level="M" fgColor="#c2410c" bgColor="#ffffff" />
                      </div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px", overflow: "hidden", minWidth: 0 }}>
                      <div style={{ background: "#ea580c", color: "#fff", padding: "8px 14px", borderRadius: "6px" }}>
                        <p style={{ fontSize: "9px", fontWeight: 500, opacity: 0.9, textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 2px" }}>Nama</p>
                        <p style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.2, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedParticipant.nama}</p>
                      </div>
                      <div style={{ background: "#ffedd5", color: "#9a3412", padding: "6px 14px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.5px", opacity: 0.7 }}>Sobat ID</span>
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>{selectedParticipant.sobat_id}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                        <div><p style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>&#128205; Kecamatan</p><p style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedParticipant.kecamatan}</p></div>
                        <div><p style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>&#128197; Gelombang</p><p style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{parseGelombang(selectedParticipant.gelombang).gel}</p></div>
                        <div><p style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>&#127970; Lokasi</p><p style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedParticipant.tempat_pelatihan}</p></div>
                        <div><p style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>&#128101; Kelas</p><p style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedParticipant.kelas}</p></div>
                      </div>
                      {parseGelombang(selectedParticipant.gelombang).waktu && (
                        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "6px 12px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px" }}>&#128197;</span>
                          <div><p style={{ fontSize: "8px", color: "#ea580c", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>Waktu Pelatihan</p><p style={{ fontSize: "13px", fontWeight: 700, color: "#9a3412", margin: "1px 0 0" }}>{parseGelombang(selectedParticipant.gelombang).waktu}</p></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8px", background: "linear-gradient(to right, #ea580c, #f97316, #fb923c)" }} />
              </div>
            </div>
          </div>
        )}

        {!selectedParticipant && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4"><Search className="h-10 w-10 text-orange-400" /></div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Cari Data Peserta</h3>
            <p className="text-gray-500 max-w-md mx-auto">Masukkan <strong>Sobat ID</strong> peserta untuk membuat nametag Pelatihan Petugas SE2026</p>
            <p className="text-gray-400 text-sm mt-2">Dibuat oleh eykman @2026</p>
          </div>
        )}
      </main>

      <footer className="border-t border-orange-100 bg-white py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          BPS Kabupaten Tasikmalaya — Pelatihan Petugas SE2026
        </div>
      </footer>
    </div>
  );
}
