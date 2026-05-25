// Participant data for Pelatihan Petugas SE2026
// BPS Kabupaten Tasikmalaya
// This data is bundled with the app as fallback for Vercel

export interface Participant {
  sobat_id: string;
  nama: string;
  kecamatan: string;
  gelombang: string;
  tempat_pelatihan: string;
  kelas: string;
  photo_filename: string;
}

export const participants: Participant[] = [
  {
    sobat_id: "SOBAT001",
    nama: "Ahmad Fauzi",
    kecamatan: "Cihaurbeuti",
    gelombang: "Gelombang 1 - 15 Januari 2026",
    tempat_pelatihan: "Hotel Grand Tasikmalaya",
    kelas: "Kelas A",
    photo_filename: "SOBAT001.jpg",
  },
  {
    sobat_id: "SOBAT002",
    nama: "Siti Nurhaliza",
    kecamatan: "Cisayong",
    gelombang: "Gelombang 1 - 15 Januari 2026",
    tempat_pelatihan: "Hotel Grand Tasikmalaya",
    kelas: "Kelas B",
    photo_filename: "SOBAT002.jpg",
  },
  {
    sobat_id: "SOBAT006",
    nama: "Rina Wati",
    kecamatan: "Sukarame",
    gelombang: "Gelombang 2 - 20 Januari 2026",
    tempat_pelatihan: "Aula BPS Tasikmalaya",
    kelas: "Kelas E",
    photo_filename: "",
  },
  {
    sobat_id: "SOBAT010",
    nama: "ERICK GUNAWAN",
    kecamatan: "CIKATOMAS",
    gelombang: "GELOMBANG 1 - 02 s/d 05 JUNI 2026",
    tempat_pelatihan: "Hotel Grand Metro Tasikmalaya",
    kelas: "Kelas B",
    photo_filename: "SOBAT010.png",
  },
];
