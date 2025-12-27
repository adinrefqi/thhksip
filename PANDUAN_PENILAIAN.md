# Sistem Penilaian dengan Multiple Komponen

## Fitur Baru: Kategori Penilaian dengan Sub-Komponen

Sistem sekarang mendukung kategori penilaian dengan multiple komponen penilaian, seperti:
- **Formatif TP** dengan TP1, TP2, TP3, TP4, TP5
- **Sumatif Lingkup Materi** dengan LM1, LM2, LM3, LM4, LM5
- Dan kategori lainnya sesuai kebutuhan

## Cara Menggunakan

### 1. **Buat Kategori Penilaian**

1. Klik menu **Kategori Nilai**
2. Klik tombol **+ Tambah Kategori**
3. Isi form berikut:
   - **Nama Kategori**: contoh "Formatif TP" atau "Sumatif Lingkup Materi"
   - **Tipe Penilaian**: Pilih "Formatif" atau "Sumatif"
   - **Jumlah Komponen**: Masukkan jumlah sub-penilaian (contoh: 5 untuk TP1-TP5)
   - **Prefix Komponen**: Masukkan awalan untuk setiap komponen (contoh: "TP" atau "LM")
4. Klik **Simpan**

### 2. **Input Nilai**

1. Klik menu **Input Nilai**
2. Pilih **Kelas**, **Mata Pelajaran**, dan **Kategori**
3. Tabel akan otomatis menampilkan kolom untuk setiap komponen penilaian
   - Contoh: Jika Anda memilih "Formatif TP" dengan 5 komponen dan prefix "TP", akan muncul kolom: TP1, TP2, TP3, TP4, TP5
4. Masukkan nilai untuk setiap komponen (0-100)
5. Klik **Simpan Semua**

### 3. **Lihat Rekap Nilai**

1. Klik menu **Rekap Nilai**
2. Pilih **Kelas** dan **Mata Pelajaran**
3. Tabel rekap akan menampilkan:
   - Semua komponen penilaian untuk setiap kategori
   - **Rata-rata** per kategori (untuk kategori dengan multiple komponen)
   - **Nilai Akhir** berdasarkan bobot yang telah diatur
   - **Predikat** (A, B, C, D)

## Contoh Struktur Penilaian

Sesuai dengan gambar yang Anda upload:

### Formatif
- **Formatif TP1**: TP1, TP2, TP3, TP4, TP5
- **Formatif TP2**: TP1, TP2, TP3, TP4, TP5
- **Formatif TP3**: TP1, TP2, TP3, TP4, TP5

### Sumatif
- **Sumatif Lingkup Materi**: LM1, LM2, LM3, LM4, LM5
- **Sumatif Tengah Semester**: (1 komponen)
- **Sumatif Akhir Semester**: (1 komponen)

## Catatan Penting

1. **Nilai Akhir** dihitung dari rata-rata setiap kategori dikalikan dengan bobotnya
2. Untuk kategori dengan multiple komponen, sistem akan menghitung rata-rata dari semua komponen yang terisi
3. Data disimpan di Supabase dan dapat di-backup/restore
4. Sistem mendukung backwards compatibility dengan data nilai lama (single value)

## Tips

- Gunakan prefix yang jelas dan singkat (contoh: "TP", "LM", "PH")
- Atur bobot setiap kategori agar total = 100%
- Pastikan jumlah komponen sesuai dengan kebutuhan kurikulum Anda
