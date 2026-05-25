"use client";

import { useState, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas-pro";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  User,
  MapPin,
  Calendar,
  Building2,
  Users,
  Loader2,
  Shield,
  Upload,
  Lock,
  X,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
  Plus,
  Cloud,
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
  sobat_id: "",
  nama: "",
  kecamatan: "",
  gelombang: "",
  tempat_pelatihan: "",
  kelas: "",
  photo_filename: "",
};

export default function Home() {
  const [sobatId, setSobatId] = useState("");
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showSearchHint, setShowSearchHint] = useState(false);
  const [showDownloadMsg, setShowDownloadMsg] = useState(false);
  const nametagRef = useRef<HTMLDivElement>(null);

  // Storage status
  const [storageStatus, setStorageStatus] = useState<{blobMode: boolean; vercel: boolean; writable: boolean; message: string} | null>(null);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminTab, setAdminTab] = useState<"upload" | "manage">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    files?: string[];
  } | null>(null);

  // Manage state
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [saving, setSaving] = useState(false);
  const [formResult, setFormResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Helper to get photo URL - supports blob URLs and local paths
  const getPhotoUrl = useCallback((filename: string) => {
    if (!filename) return null;
    if (filename.startsWith("http")) return filename;
    return `/api/photo?filename=${encodeURIComponent(filename)}`;
  }, []);

  const handleSearch = useCallback(async () => {
    if (!sobatId.trim()) return;
    setIsLoading(true);
    setNotFound(false);
    setSelectedParticipant(null);
    setPhotoUrl(null);

    try {
      const res = await fetch(
        `/api/participants?sobat_id=${encodeURIComponent(sobatId.trim())}`
      );
      const data = await res.json();
      const participants: Participant[] = data.participants || [];

      if (participants.length > 0) {
        const participant = participants[0];
        setSelectedParticipant(participant);
        setPhotoUrl(getPhotoUrl(participant.photo_filename));
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [sobatId, getPhotoUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDownload = async () => {
    if (!nametagRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(nametagRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `nametag-${selectedParticipant?.sobat_id || "unknown"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowDownloadMsg(true);
      setTimeout(() => setShowDownloadMsg(false), 10000);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

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
    } catch {
      setStorageStatus(null);
    }
  };

  const loadAllParticipants = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/participants", {
        headers: { "x-admin-password": adminPassword },
      });
      const data = await res.json();
      if (res.ok) {
        setAllParticipants(data.participants || []);
      }
    } catch {
      setAllParticipants([]);
    } finally {
      setLoadingData(false);
    }
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
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormResult({ success: false, message: "File harus berupa gambar (JPG, PNG, dll)" });
      return;
    }

    setFormPhotoFile(file);
    setFormResult(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    const ext = file.name.split(".").pop() || "jpg";
    if (editParticipant) {
      setEditParticipant({
        ...editParticipant,
        photo_filename: `${editParticipant.sobat_id || "SOBAT"}.${ext}`,
      });
    }
  };

  const handleSaveParticipant = async () => {
    if (!editParticipant || !editParticipant.sobat_id || !editParticipant.nama) {
      setFormResult({ success: false, message: "Sobat ID dan Nama wajib diisi" });
      return;
    }

    if (!editParticipant.photo_filename) {
      editParticipant.photo_filename = `${editParticipant.sobat_id}.jpg`;
    }

    setSaving(true);
    setFormResult(null);

    try {
      // Upload photo first if selected
      if (formPhotoFile) {
        setUploadingPhoto(true);
        const photoFormData = new FormData();
        photoFormData.append("photo", formPhotoFile);
        photoFormData.append("sobat_id", editParticipant.sobat_id);

        const photoRes = await fetch("/api/admin/photo", {
          method: "POST",
          headers: { "x-admin-password": adminPassword },
          body: photoFormData,
        });

        const photoData = await photoRes.json();
        setUploadingPhoto(false);

        if (photoRes.ok && photoData.filename) {
          editParticipant.photo_filename = photoData.filename;
        }
      }

      const res = await fetch("/api/admin/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
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
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });

      const data = await res.json();

      if (res.ok) {
        setAllParticipants(data.participants || []);
        setDeleteConfirm(null);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const parseGelombang = (gelombang: string) => {
    const parts = gelombang.split(" - ");
    const gel = parts[0]?.trim() || gelombang;
    const waktu = parts[1]?.trim() || "";
    return { gel, waktu };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            <img
              src="/logo-bps.png"
              alt="Logo BPS"
              className="h-14 w-14 object-contain bg-white rounded-full p-1"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Pelatihan Petugas SE2026
              </h1>
              <p className="text-orange-100 text-sm md:text-base">
                BPS Kabupaten Tasikmalaya
              </p>
            </div>
            <img
              src="/logo-se.png"
              alt="Logo Sensus Ekonomi"
              className="h-14 w-14 object-contain bg-white rounded-full p-1 shrink-0"
            />

            {/* Admin Button */}
            <Dialog
              open={adminOpen}
              onOpenChange={(open) => {
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
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white gap-2 ml-2 shrink-0"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-orange-800">
                    <Shield className="h-5 w-5" />
                    Panel Admin
                  </DialogTitle>
                </DialogHeader>

                {!adminAuthenticated ? (
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-600">
                      Masukkan password admin untuk mengakses fitur pengelolaan data.
                    </p>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                      <Input
                        type="password"
                        placeholder="Password admin..."
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                        className="pl-10 border-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <Button
                      onClick={handleAdminLogin}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      Masuk
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {/* Storage status notice */}
                    {storageStatus && !storageStatus.writable ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            Vercel Blob Storage Belum Diaktifkan
                          </p>
                          <p className="text-xs text-amber-700">
                            Fitur admin (upload, tambah, edit, hapus) memerlukan Vercel Blob Storage. Buka Vercel Dashboard → Project → Storage → Create Blob → Link → Redeploy.
                          </p>
                        </div>
                      </div>
                    ) : storageStatus && storageStatus.blobMode ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <Cloud className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">
                            Penyimpanan Cloud Aktif
                          </p>
                          <p className="text-xs text-blue-700">
                            Data peserta dan foto disimpan di Vercel Blob. Semua fitur admin tersedia.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">
                            Mode Lokal
                          </p>
                          <p className="text-xs text-green-700">
                            Data disimpan di komputer lokal. Semua fitur admin tersedia.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-orange-200">
                      <button
                        onClick={() => setAdminTab("upload")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          adminTab === "upload"
                            ? "border-orange-600 text-orange-700"
                            : "border-transparent text-gray-500 hover:text-orange-600"
                        }`}
                      >
                        <Upload className="h-4 w-4 inline mr-1.5" />
                        Upload ZIP
                      </button>
                      <button
                        onClick={() => {
                          setAdminTab("manage");
                          loadAllParticipants();
                        }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          adminTab === "manage"
                            ? "border-orange-600 text-orange-700"
                            : "border-transparent text-gray-500 hover:text-orange-600"
                        }`}
                      >
                        <Users className="h-4 w-4 inline mr-1.5" />
                        Kelola Data Peserta
                      </button>
                    </div>

                    {/* Upload Tab */}
                    {adminTab === "upload" && (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                          <Cloud className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-green-800">
                              Panduan Upload
                            </p>
                            <p className="text-xs text-green-700">
                              Unggah file ZIP berisi foto peserta dan/atau data CSV. File akan disimpan ke cloud storage dan tersedia secara online.
                            </p>
                          </div>
                        </div>

                        <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center bg-orange-50/50">
                          <Upload className="h-10 w-10 text-orange-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-orange-800 mb-1">
                            Upload File ZIP
                          </p>
                          <p className="text-xs text-gray-500 mb-3">
                            File ZIP berisi foto peserta (.jpg/.png) dan/atau file data peserta (.csv)
                          </p>
                          <label className="inline-flex items-center gap-2 cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            {uploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Mengunggah...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                Pilih File ZIP
                              </>
                            )}
                            <input
                              type="file"
                              accept=".zip"
                              onChange={handleUpload}
                              className="hidden"
                              disabled={uploading}
                            />
                          </label>
                        </div>

                        {uploadResult && (
                          <div
                            className={`rounded-lg p-3 flex items-start gap-2 ${
                              uploadResult.success
                                ? "bg-green-50 border border-green-200"
                                : "bg-red-50 border border-red-200"
                            }`}
                          >
                            {uploadResult.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-semibold ${
                                  uploadResult.success ? "text-green-800" : "text-red-800"
                                }`}
                              >
                                {uploadResult.message}
                              </p>
                              {uploadResult.files && uploadResult.files.length > 0 && (
                                <div className="mt-1 max-h-24 overflow-y-auto">
                                  {uploadResult.files.map((f, i) => (
                                    <p key={i} className="text-xs text-gray-600 truncate">
                                      {f}
                                    </p>
                                  ))}
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
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Total: <strong>{allParticipants.length}</strong> peserta
                          </p>
                          <Button
                            onClick={() => {
                              setFormMode("add");
                              setEditParticipant({ ...emptyParticipant });
                              setShowForm(true);
                              setFormResult(null);
                              setFormPhotoFile(null);
                              setFormPhotoPreview(null);
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-sm h-8"
                          >
                            <Plus className="h-4 w-4" />
                            Tambah Peserta
                          </Button>
                        </div>

                        {/* Form for add/edit */}
                        {showForm && editParticipant && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                            <p className="text-sm font-semibold text-orange-800">
                              {formMode === "add" ? "Tambah Peserta Baru" : `Edit Peserta: ${editParticipant.sobat_id}`}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-600">Sobat ID *</Label>
                                <Input
                                  value={editParticipant.sobat_id}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, sobat_id: e.target.value.toUpperCase() })
                                  }
                                  disabled={formMode === "edit"}
                                  placeholder="SOBAT007"
                                  className="h-9 text-sm uppercase"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Nama *</Label>
                                <Input
                                  value={editParticipant.nama}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, nama: e.target.value })
                                  }
                                  placeholder="Nama Lengkap"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Kecamatan</Label>
                                <Input
                                  value={editParticipant.kecamatan}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, kecamatan: e.target.value })
                                  }
                                  placeholder="Nama Kecamatan"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Gelombang</Label>
                                <Input
                                  value={editParticipant.gelombang}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, gelombang: e.target.value })
                                  }
                                  placeholder="Gelombang 1 - 15 Januari 2026"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Lokasi Pelatihan</Label>
                                <Input
                                  value={editParticipant.tempat_pelatihan}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, tempat_pelatihan: e.target.value })
                                  }
                                  placeholder="Hotel Grand Tasikmalaya"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Kelas</Label>
                                <Input
                                  value={editParticipant.kelas}
                                  onChange={(e) =>
                                    setEditParticipant({ ...editParticipant, kelas: e.target.value })
                                  }
                                  placeholder="Kelas A"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-600">Foto Peserta</Label>
                                <div className="flex items-start gap-3 mt-1">
                                  <div className="w-20 h-24 border-2 border-dashed border-orange-300 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                                    {formPhotoPreview ? (
                                      <img src={formPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : editParticipant.photo_filename && formMode === "edit" ? (
                                      <img
                                        src={getPhotoUrl(editParticipant.photo_filename) || ""}
                                        alt="Foto"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    ) : null}
                                    {!formPhotoPreview && !(editParticipant.photo_filename && formMode === "edit") && (
                                      <div className="text-center text-orange-400">
                                        <Upload className="h-5 w-5 mx-auto" />
                                        <span className="text-[9px]">Foto</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                                      {uploadingPhoto ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          Mengunggah...
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="h-3.5 w-3.5" />
                                          Pilih Foto
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                        disabled={uploadingPhoto}
                                      />
                                    </label>
                                    <p className="text-[10px] text-gray-400">
                                      Format: JPG, PNG, GIF, WebP. Maks 5MB.
                                    </p>
                                    {editParticipant.photo_filename && (
                                      <p className="text-[10px] text-gray-500">
                                        File: {editParticipant.photo_filename}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {formResult && (
                              <div
                                className={`rounded p-2 flex items-center gap-2 text-sm ${
                                  formResult.success
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {formResult.success ? (
                                  <CheckCircle className="h-4 w-4 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                )}
                                {formResult.message}
                              </div>
                            )}

                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowForm(false);
                                  setEditParticipant(null);
                                  setFormResult(null);
                                }}
                                className="text-sm h-8"
                              >
                                Batal
                              </Button>
                              <Button
                                onClick={handleSaveParticipant}
                                disabled={saving}
                                className="bg-orange-600 hover:bg-orange-700 text-white text-sm h-8 gap-1.5"
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                {saving ? "Menyimpan..." : "Simpan"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Participants Table */}
                        {loadingData ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
                            <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
                          </div>
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
                                  {allParticipants.map((p, idx) => (
                                    <tr
                                      key={p.sobat_id}
                                      className={`border-t border-orange-100 ${
                                        idx % 2 === 0 ? "bg-white" : "bg-orange-50/30"
                                      }`}
                                    >
                                      <td className="px-3 py-2 font-mono text-xs font-semibold text-orange-700">
                                        {p.sobat_id}
                                      </td>
                                      <td className="px-3 py-2 text-gray-800 truncate max-w-[150px]">
                                        {p.nama}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 truncate max-w-[100px] hidden md:table-cell">
                                        {p.kecamatan}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 hidden md:table-cell">
                                        {p.kelas}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => {
                                              setFormMode("edit");
                                              setEditParticipant({ ...p });
                                              setShowForm(true);
                                              setFormResult(null);
                                              setFormPhotoFile(null);
                                              setFormPhotoPreview(null);
                                            }}
                                            className="p-1.5 rounded-md hover:bg-orange-100 text-orange-600 transition-colors"
                                            title="Edit"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          {deleteConfirm === p.sobat_id ? (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => handleDeleteParticipant(p.sobat_id)}
                                                className="p-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                                                title="Konfirmasi Hapus"
                                              >
                                                <CheckCircle className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="p-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                                title="Batal"
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => setDeleteConfirm(p.sobat_id)}
                                              className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                                              title="Hapus"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {allParticipants.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                                        Belum ada data peserta
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1">
        {/* Search Section */}
        <Card className="mb-8 border-orange-200 shadow-md">
          <CardHeader className="bg-orange-50 border-b border-orange-100">
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <Search className="h-5 w-5" />
              Cari Data Peserta
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                <Input
                  placeholder="Masukkan Sobat ID"
                  value={sobatId}
                  onChange={(e) => {
                    setSobatId(e.target.value);
                    setNotFound(false);
                  }}
                  onFocus={() => setShowSearchHint(true)}
                  onBlur={() => setShowSearchHint(false)}
                  onKeyDown={handleKeyDown}
                  className="pl-10 border-orange-200 focus:border-orange-500 focus:ring-orange-500 text-base h-12 uppercase"
                />
                {showSearchHint && !sobatId && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                    <p className="text-sm text-blue-700">
                      Sobat ID dapat di lihat pada{" "}
                      <a
                        href="https://mitra.bps.go.id/beranda"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline hover:text-blue-900"
                      >
                        www.mitra.bps.go.id
                      </a>
                    </p>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSearch}
                disabled={isLoading || !sobatId.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 h-12 text-base font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Cari"
                )}
              </Button>
            </div>

            {notFound && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">
                  Peserta dengan Sobat ID <strong>&quot;{sobatId}&quot;</strong> tidak ditemukan. Pastikan ID sudah benar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nametag Display */}
        {selectedParticipant && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-orange-800">
                Nametag Peserta
              </h2>
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDownloading ? "Mengunduh..." : "Unduh PNG"}
              </Button>
            </div>

            {/* Download info message */}
            {showDownloadMsg && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle className="h-6 w-6 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-base font-semibold text-orange-800 mb-1">
                    Nametag Berhasil Diunduh!
                  </p>
                  <p className="text-sm text-orange-700 leading-relaxed">
                    Simpan NameTag Anda dengan Baik, Perlihatkan Kepada Petugas Ketika Berada di Lokasi Training Center yang telah di Tentukan. Terima Kasih.
                  </p>
                </div>
                <button
                  onClick={() => setShowDownloadMsg(false)}
                  className="shrink-0 ml-auto text-orange-400 hover:text-orange-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Nametag Card */}
            <div className="flex justify-center">
              <div
                ref={nametagRef}
                className="relative bg-white border-2 border-orange-400 overflow-hidden"
                style={{
                  width: "600px",
                  height: "380px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {/* Orange top accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "8px",
                    background: "linear-gradient(to right, #ea580c, #f97316, #fb923c)",
                  }}
                />

                {/* Content area */}
                <div
                  style={{
                    padding: "14px 20px 16px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Header with logos */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      marginBottom: "10px",
                    }}
                  >
                    <img
                      src="/logo-bps.png"
                      alt="BPS"
                      style={{ height: "44px", width: "44px", objectFit: "contain" }}
                    />
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          color: "#c2410c",
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          margin: 0,
                        }}
                      >
                        Badan Pusat Statistik
                      </p>
                      <p
                        style={{
                          color: "#9a3412",
                          fontSize: "13px",
                          fontWeight: 700,
                          margin: "2px 0",
                        }}
                      >
                        Kabupaten Tasikmalaya
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            height: "2px",
                            width: "24px",
                            background: "#f97316",
                          }}
                        />
                        <p
                          style={{
                            color: "#ea580c",
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "1.5px",
                            textTransform: "uppercase",
                            margin: 0,
                          }}
                        >
                          Pelatihan Petugas SE2026
                        </p>
                        <div
                          style={{
                            height: "2px",
                            width: "24px",
                            background: "#f97316",
                          }}
                        />
                      </div>
                    </div>
                    <img
                      src="/logo-se.png"
                      alt="SE2026"
                      style={{ height: "44px", width: "44px", objectFit: "contain" }}
                    />
                  </div>

                  {/* Orange divider */}
                  <div
                    style={{
                      height: "3px",
                      background:
                        "linear-gradient(to right, transparent, #f97316, transparent)",
                      marginBottom: "12px",
                    }}
                  />

                  {/* Main content: Photo + QR | Info */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      flex: 1,
                      minHeight: 0,
                    }}
                  >
                    {/* Left side: Photo and QR Code */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {/* Photo */}
                      <div
                        style={{
                          width: "120px",
                          height: "140px",
                          border: "2px solid #fb923c",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#fff7ed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={selectedParticipant.nama}
                            crossOrigin="anonymous"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ea580c",
                            }}
                          >
                            <span style={{ fontSize: "36px", lineHeight: 1 }}>
                              &#128100;
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                marginTop: "4px",
                              }}
                            >
                              {getInitials(selectedParticipant.nama)}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* QR Code */}
                      <div
                        style={{
                          background: "#fff",
                          padding: "6px",
                          border: "1px solid #fdba74",
                          borderRadius: "6px",
                        }}
                      >
                        <QRCodeSVG
                          value={selectedParticipant.sobat_id}
                          size={72}
                          level="M"
                          fgColor="#c2410c"
                          bgColor="#ffffff"
                        />
                      </div>
                    </div>

                    {/* Right side: Participant info */}
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: "8px",
                        overflow: "hidden",
                        minWidth: 0,
                      }}
                    >
                      {/* Name */}
                      <div
                        style={{
                          background: "#ea580c",
                          color: "#fff",
                          padding: "8px 14px",
                          borderRadius: "6px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "9px",
                            fontWeight: 500,
                            opacity: 0.9,
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                            margin: "0 0 2px",
                          }}
                        >
                          Nama
                        </p>
                        <p
                          style={{
                            fontSize: "20px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {selectedParticipant.nama}
                        </p>
                      </div>

                      {/* Sobat ID */}
                      <div
                        style={{
                          background: "#ffedd5",
                          color: "#9a3412",
                          padding: "6px 14px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                            opacity: 0.7,
                          }}
                        >
                          Sobat ID
                        </span>
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                          }}
                        >
                          {selectedParticipant.sobat_id}
                        </span>
                      </div>

                      {/* Info grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "6px 12px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: "8px",
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            &#128205; Kecamatan
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#1f2937",
                              margin: "1px 0 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {selectedParticipant.kecamatan}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "8px",
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            &#128197; Gelombang
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#1f2937",
                              margin: "1px 0 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {parseGelombang(selectedParticipant.gelombang).gel}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "8px",
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            &#127970; Lokasi
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#1f2937",
                              margin: "1px 0 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {selectedParticipant.tempat_pelatihan}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "8px",
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              fontWeight: 600,
                              margin: 0,
                            }}
                          >
                            &#128101; Kelas
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#1f2937",
                              margin: "1px 0 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {selectedParticipant.kelas}
                          </p>
                        </div>
                      </div>

                      {/* Waktu Pelatihan */}
                      {parseGelombang(selectedParticipant.gelombang).waktu && (
                        <div
                          style={{
                            background: "#fff7ed",
                            border: "1px solid #fed7aa",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>&#128197;</span>
                          <div>
                            <p
                              style={{
                                fontSize: "8px",
                                color: "#ea580c",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              Waktu Pelatihan
                            </p>
                            <p
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: "#9a3412",
                                margin: "1px 0 0",
                              }}
                            >
                              {parseGelombang(selectedParticipant.gelombang).waktu}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom orange bar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "8px",
                    background:
                      "linear-gradient(to right, #ea580c, #f97316, #fb923c)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedParticipant && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-10 w-10 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Cari Data Peserta
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Masukkan <strong>Sobat ID</strong> peserta
              untuk membuat nametag Pelatihan Petugas SE2026
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Dibuat oleh eykman @2026
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100 bg-white py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          BPS Kabupaten Tasikmalaya — Pelatihan Petugas Sensus Ekonomi 2026
        </div>
      </footer>
    </div>
  );
}
