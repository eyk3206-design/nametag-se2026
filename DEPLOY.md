# NameTag Peserta Pelatihan SE2026
## BPS Kabupaten Tasikmalaya

Aplikasi pembuatan nametag digital untuk Pelatihan Petugas Sensus Ekonomi 2026.

---

## 🚀 Deploy ke Vercel (Online Permanen)

### Langkah 1: Buat Repository GitHub

1. Buka [github.com/new](https://github.com/new)
2. Nama repository: `nametag-se2026`
3. Pilih **Private** (rekomendasi, karena ada data peserta)
4. **JANGAN** centang "Add a README file"
5. Klik **Create repository**

### Langkah 2: Upload Kode ke GitHub

#### Opsi A: Upload via Browser (Paling Mudah)
1. Download file `nametag-se2026-source.tar.gz`
2. Extract di komputer Anda
3. Buka folder hasil extract
4. Di GitHub repository, klik **"uploading an existing file"**
5. Drag & drop semua file dan folder
6. Klik **Commit changes**

#### Opsi B: Upload via Git Command Line
```bash
# Extract file yang sudah didownload
tar xzf nametag-se2026-source.tar.gz -C nametag-se2026
cd nametag-se2026

# Inisialisasi git
git init
git add -A
git commit -m "Initial commit - NameTag SE2026"

# Hubungkan ke GitHub (ganti USERNAME dengan username GitHub Anda)
git remote add origin https://github.com/USERNAME/nametag-se2026.git
git branch -M main
git push -u origin main
```

### Langkah 3: Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new)
2. Login dengan akun GitHub
3. Klik **"Import Git Repository"**
4. Pilih repository `nametag-se2026`
5. Klik **Deploy**
6. Tunggu 1-2 menit sampai selesai
7. Website Anda online!

### Langkah 4: Setup Vercel Blob Storage (WAJIB untuk fitur Admin)

Agar fitur Admin (upload ZIP, tambah/edit/hapus peserta, upload foto) berfungsi di Vercel, Anda perlu mengaktifkan **Vercel Blob Storage**:

1. Buka [vercel.com/dashboard](https://vercel.com/dashboard)
2. Pilih project `nametag-se2026`
3. Klik tab **Storage**
4. Klik **Create Database** atau **Browse Marketplace**
5. Pilih **Blob** (Vercel Blob)
6. Klik **Create & Continue**
7. Pilih project `nametag-se2026` dan klik **Link**
8. Environment variable `BLOB_READ_WRITE_TOKEN` akan otomatis ditambahkan
9. Klik **Deploy again** untuk deploy ulang dengan storage terhubung

> **Tanpa Vercel Blob**: Aplikasi tetap berjalan dengan data bawaan (4 peserta contoh), tapi fitur admin tidak bisa menyimpan perubahan secara permanen.

> **Dengan Vercel Blob**: Semua fitur admin berfungsi penuh - upload ZIP, tambah/edit/hapus peserta, upload foto - semua data tersimpan di cloud.

---

## 💻 Jalankan di Komputer Lokal

Jika ingin menjalankan tanpa Vercel:

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Buka browser ke http://localhost:3000
```

Di mode lokal, data disimpan di filesystem (file CSV + folder foto), semua fitur admin berfungsi tanpa perlu setup apapun.

### Password Admin: `eykman04`

---

## 📋 Fitur

| Fitur | Vercel + Blob | Vercel tanpa Blob | Lokal |
|-------|:-:|:-:|:-:|
| Cari peserta by Sobat ID | ✅ | ✅ | ✅ |
| Tampilkan nametag lengkap | ✅ | ✅ | ✅ |
| Download nametag PNG | ✅ | ✅ | ✅ |
| QR Code dari Sobat ID | ✅ | ✅ | ✅ |
| Admin - lihat data peserta | ✅ | ✅ | ✅ |
| Admin - upload ZIP | ✅ | ❌ | ✅ |
| Admin - tambah/edit/hapus peserta | ✅ | ❌ | ✅ |
| Admin - upload foto | ✅ | ❌ | ✅ |

---

## 📁 Struktur File Penting

```
├── src/
│   ├── app/
│   │   ├── page.tsx          # Halaman utama
│   │   ├── layout.tsx        # Layout & metadata
│   │   └── api/              # API routes
│   │       ├── participants/  # Pencarian peserta
│   │       ├── photo/        # Sajikan foto
│   │       ├── storage-status/ # Status penyimpanan
│   │       └── admin/        # Panel admin
│   │           ├── upload/    # Upload ZIP
│   │           ├── participants/ # CRUD peserta
│   │           └── photo/     # Upload foto
│   ├── lib/
│   │   └── storage.ts        # Data access layer (Blob/Local)
│   └── data/
│       └── participants.ts   # Data peserta (bundled fallback)
├── public/
│   ├── photos/               # Foto peserta (static)
│   ├── logo-bps.png          # Logo BPS
│   ├── logo-se.png           # Logo Sensus Ekonomi
│   └── favicon.ico           # Icon browser
├── vercel.json               # Konfigurasi Vercel
└── next.config.ts            # Konfigurasi Next.js
```

---

## 🔄 Update Data Peserta di Vercel

Dengan Vercel Blob aktif, update data peserta bisa dilakukan langsung dari website:
1. Buka website Vercel
2. Klik tombol **Admin** (ikon shield)
3. Masukkan password: `eykman04`
4. Upload ZIP atau kelola data peserta langsung dari browser

Tanpa Vercel Blob, data harus diupdate melalui kode:
1. Jalankan di komputer lokal
2. Update file `src/data/participants.ts` dengan data terbaru
3. Copy foto baru ke `public/photos/`
4. Commit dan push ke GitHub
5. Vercel akan otomatis deploy ulang

---

## 🔧 Environment Variables

| Variable | Kegunaan | Wajib |
|----------|----------|-------|
| `BLOB_READ_WRITE_TOKEN` | Token akses Vercel Blob Storage | Ya (untuk admin di Vercel) |
| `ADMIN_PASSWORD` | Password admin (default: `eykman04`) | Tidak |

---

Dibuat oleh eykman @2026
