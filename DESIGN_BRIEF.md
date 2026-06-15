# Design Brief — "Saham Monitor" (Aplikasi Pemantau Saham Indonesia / IHSG)

> **Untuk: Claude (design).** Ini brief mandiri — kamu tidak butuh konteks lain.
> **Tugasmu:** eksplorasi & rancang UI **kelas premium** untuk aplikasi ini, lalu
> wujudkan sebagai **mockup hi-fi interaktif** (artifact). Versi sebelumnya dibuat
> di Streamlit dan hasilnya flat/biasa — tolong lampaui itu jauh.

---

## 1. Konteks Produk

**Saham Monitor** = dashboard **pribadi** (single-user, dipakai sendiri di desktop)
untuk **memantau saham Indonesia (IHSG / Bursa Efek Indonesia)**. Bukan untuk eksekusi
order — fokus *monitoring & analisa*. Mata uang **Rupiah (IDR)**, 1 lot = 100 lembar.
Pengguna: investor ritel Indonesia yang ingin tampilan modern, jelas, dan menyenangkan
dipakai harian.

6 layar: **Dashboard, Riset Saham, Portofolio, Alert, Berita, Pengaturan.**

---

## 2. Arah Estetika (titik awal — silakan eksplorasi & tingkatkan)

Arah yang diinginkan user: **"fintech modern, terang, aksen hijau"** — referensi rasa:
**Bibit, Robinhood, Revolut, Wise, Stockbit**. Bersih, ramah, banyak whitespace, kartu
membulat, hijau segar sebagai warna brand/positif.

**Tolong jangan berhenti di "flat & plain".** Yang diharapkan: kedalaman visual yang
matang — hierarki kuat, shadow berlapis halus, micro-interaction, data-viz yang indah,
ornamen halus (gradient lembut, ilustrasi/aksen, glassmorphism tipis bila pas), state
yang dipikirkan (hover/empty/loading). **Boleh tawarkan 2–3 arah visual berbeda** untuk
Dashboard dulu, lalu kembangkan yang dipilih.

**Konvensi wajib pasar saham:** hijau = NAIK, merah = TURUN; selalu sertakan tanda
(+/−) & panah, bukan hanya warna (aksesibilitas). **Locale Indonesia:** ribuan pakai
TITIK, desimal pakai KOMA → `6.231,97`. Persen `+3,73%`.

---

## 3. Batasan WAJIB (non-negosiabel)

1. **DILARANG memakai emoji/emoticon di UI mana pun.** Gunakan **icon set vektor proper**
   (rekomendasi: **Lucide** / Phosphor / Heroicons / Tabler) — konsisten satu set.
2. **Desktop-first** (layout lebar, sidebar kiri + konten), tetap responsif.
3. **Aksesibilitas:** kontras cukup (WCAG AA), target klik memadai, tidak hanya warna.
4. **Angka rapi:** font dengan tabular-nums, rata kanan di tabel, format locale ID.
5. **Konsisten:** satu design system (tokens) untuk warna, tipografi, spacing, radius,
   shadow, komponen. Sertakan style guide singkat.

---

## 4. Sistem Desain yang Diharapkan (silakan sempurnakan)

- **Warna:** latar terang (putih/abu sangat muda), kartu putih; aksen **hijau segar**
  (mis. ~#16C784) untuk brand & naik; merah (~#F6465D) untuk turun; netral slate untuk
  teks (#0F172A primary, #52617A sekunder, #94A3B8 muted); border sangat halus (#E9EDF2).
  Boleh tambah 1 warna pendukung (biru/ungu) untuk aksen data sekunder.
- **Tipografi:** font sans modern (Inter / Plus Jakarta Sans / Geist). Heading tebal,
  angka tabular. Skala jelas.
- **Spacing & bentuk:** grid 8px, banyak whitespace, radius besar (12–20px), shadow
  lembut berlapis (bukan border tebal).
- **Komponen:** sidebar nav (ikon + label, state aktif jelas), KPI card, tabel data
  (sortable look), badge/pill, button (primary hijau + secondary), input/form, tabs,
  toast, chart (candlestick, line/area, donut, sparkline), status indicator (dot).

---

## 5. Spesifikasi Layar + Data Contoh (gunakan untuk membuat mockup terlihat NYATA)

> Format angka di bawah sudah locale Indonesia. IHSG = indeks; saham pakai kode 4 huruf.

### 5.1 Dashboard (layar utama)
Elemen:
- **Ticker tape** berjalan di atas (opsional, elegan): daftar saham + harga + %.
- **Header**: judul "Dashboard Pasar" + **status bar** (status bursa BUKA/TUTUP dengan
  dot, jam `10:18 WIB`, sumber data "delayed ~15–20 mnt" atau "realtime").
- **Ringkasan Pasar** — 4 KPI card: IHSG + 3 saham penggerak terbesar. Tiap card: nama,
  kode, harga besar, perubahan (Δ + Δ%) berwarna, opsional mini-sparkline.
- **Watchlist** — tabel: Kode, Nama, **sparkline tren 30 hari**, Harga Terakhir, Δ, Δ%,
  Volume. Baris hover, warna naik/turun.
- **Detail instrumen** — pilih 1 saham → **chart candlestick** + metrik
  (Terakhir/Tertinggi/Terendah/Volume) + pemilih periode (1B/3B/6B/1T/3T/5T).

Data contoh:
```
IHSG (Jakarta Composite): 6.231,97  ▲ +224 (+3,73%)
Watchlist:
  ANTM  Aneka Tambang          3.100   ▲ +260  (+8,77%)   Vol 155,9 Jt
  ASII  Astra International     4.950   ▲ +210  (+4,43%)   Vol 20,8 Jt
  BBCA  Bank Central Asia       6.250   ▲ +325  (+5,49%)   Vol 135,0 Jt
  BBRI  Bank Rakyat Indonesia   2.970   ▲ +110  (+3,86%)   Vol 243,7 Jt
  BMRI  Bank Mandiri            4.430   ▲ +220  (+5,48%)   Vol 83,4 Jt
  TLKM  Telkom Indonesia        2.930   ▲ +70   (+2,45%)   Vol 18,1 Jt
  BUMI  Bumi Resources          170     ▲ +13   (+8,28%)   Vol 1,2 M
  GOTO  GoTo Gojek Tokopedia    50      ■ 0     (0,00%)    Vol 4,1 M
  CDIA  Chandra Daya Investasi  730     ▲ +40   (+5,80%)   Vol 99,7 Jt
  DCII  DCI Indonesia           188.900 ▲ +90   (+0,05%)   Vol 0,3 Jt
```

### 5.2 Riset Saham (analisa 1 emiten, 4 tab)
- **Pemilih emiten** (dropdown + ketik kode).
- **Tab Ringkasan:** KPI harga (Harga/Tertinggi/Terendah/Volume) + KPI valuasi
  (Kapitalisasi/PER/PBV/Dividend Yield) + rentang 52 minggu + sektor.
- **Tab Fundamental:** tabel rasio (sektor, industri, market cap, PER, PBV, EPS, book
  value, dividend yield, ROE, net margin, DER, beta).
- **Tab Analisis Teknikal:** **verdict agregat** (badge BULLISH/NETRAL/BEARISH) +
  **signal chips** (RSI, Harga vs SMA50, SMA50 vs SMA200 golden/death cross, MACD) +
  **chart multi-panel** (candlestick + SMA/Bollinger, panel Volume, panel RSI, panel MACD).
- **Tab Berita:** rollup sentimen + daftar kartu berita emiten.

Data contoh (ANTM — Aneka Tambang):
```
Harga 3.100 ▲ +180 (+6,32%) · Tertinggi 3.040 · Terendah 2.950 · Volume 72,3 Jt
Kapitalisasi 72,81 T · PER 10,10x · PBV 1,87x · Dividend Yield 5,33%
Rentang 52 minggu: 2.450 – 4.970 · Sektor: Basic Materials
Teknikal: RSI(14) 43 (Netral) · Harga di bawah SMA50 (tren turun) ·
          SMA50 > SMA200 (Golden cross) · MACD bullish  → Verdict: NETRAL
```

### 5.3 Portofolio
- **Form catat transaksi:** Tanggal, Kode, Tipe (BUY/SELL), Lot, Harga/lembar, Fee.
- **KPI:** Nilai Pasar (+Δ hari ini), Total Modal, P/L Belum Terealisasi (+%),
  P/L Terealisasi.
- **Tabel posisi:** Kode, Nama, Lot, Harga Rata-rata, Terakhir, Nilai, P/L, P/L%, Bobot.
- **Alokasi:** donut by nilai. **Pertumbuhan Nilai (NAV):** area chart + metrik
  (Return, Max Drawdown, Sharpe).
- **Riwayat transaksi:** daftar + aksi hapus.
- **Empty state** (belum ada transaksi) yang ramah & mengarahkan.

Data contoh:
```
Nilai Pasar Rp 11.880.000  ▲ +174.000 (+1,79%) hari ini
Total Modal Rp 11.479.650 · P/L Belum Terealisasi −Rp 1.599.650 (−13,93%) · Realized Rp 0
Posisi:
  BBCA  Bank Central Asia   8 lot  avg 8.310  last 6.250  Nilai 5.000.000  P/L −1.648.000 (−24,8%)  Bobot 48%
  TLKM  Telkom Indonesia   10 lot  avg 3.045  last 2.930  Nilai 2.930.000  P/L −115.000  (−3,8%)   Bobot 29%
  ANTM  Aneka Tambang       8 lot  avg 2.233  last 3.100  Nilai 2.480.000  P/L +693.600  (+38,8%)  Bobot 23%
```

### 5.4 Alert
- **Form buat alert:** Instrumen, Metrik (Harga / Perubahan harian %), Kondisi
  (≥, ≤, >, <), Nilai, Cooldown (menit), Kanal (in-app / Telegram / Desktop).
- **Daftar alert aktif:** toggle aktif/nonaktif, kondisi, kanal, cooldown, hapus.
- **Riwayat pemicu** (alert yang sudah berbunyi).
- **Status kanal** notifikasi.

Data contoh:
```
Alert aktif:
  BBCA  Harga ≥ 7.000      kanal: in-app, telegram   cooldown 30m   [aktif]
  ANTM  Perubahan % ≤ −3   kanal: in-app             cooldown 15m   [aktif]
Riwayat: "BBCA: Harga 7.025 ≥ 7.000" — 15 Jun 10:12
```

### 5.5 Berita
- **Filter sumber:** Pasar (umum) / per-emiten.
- **Rollup sentimen:** Total, Positif, Negatif, Netral + bar proporsi.
- **Kartu berita:** judul, sumber, waktu, **badge sentimen** (positif/negatif/netral), link.

Data contoh:
```
Total 45 berita · Positif 9 · Negatif 1 · Netral 35
- "Arah Pasar Saham Global 15–19 Juni: Wall Street & Bursa Asia" — Google News · 14 Jun 22:00 · [netral]
- "BEI Hukum Emiten Telat Lapor, Denda hingga Rp 150 Juta" — kontan.co.id · 14 Jun · [netral]
- "ANTM Lanjutkan Penguatan, Volume Melonjak" — CNBC Indonesia · [positif]
```

### 5.6 Pengaturan
- **Watchlist:** tambah/hapus instrumen.
- **Koneksi data & notifikasi:** input API key (harga realtime, fundamental, Telegram
  bot token & chat id) — field rahasia.
- **Info:** status realtime/delayed, mata uang/lot/fee, dll.

---

## 6. Komponen Kunci yang Perlu Dirancang Indah

1. **KPI / metric card** — label kecil + angka besar + delta pill berwarna + (opsi) sparkline.
2. **Watchlist row** — kode tebal + nama + sparkline + angka tabular + Δ% berwarna; hover halus.
3. **Candlestick chart** + overlay SMA/Bollinger + panel volume/RSI/MACD (gaya TradingView, terang).
4. **Donut alokasi** & **area chart NAV** yang bersih.
5. **Sentiment badge** & **verdict badge** (BULLISH/NETRAL/BEARISH).
6. **Status bar** bursa (dot berdenyut buka/tutup).
7. **Sidebar nav** dengan ikon Lucide + state aktif jelas + brand "Saham Monitor".
8. **Empty/loading/error states** untuk tiap layar.

---

## 7. Deliverable yang Diminta

1. **Mockup hi-fi interaktif** sebagai **artifact** — disarankan **HTML + Tailwind CSS
   (single file)** atau **React**, memakai ikon **Lucide** dan font Google. Harus terlihat
   nyata (pakai data contoh di atas), bukan wireframe abu-abu.
2. **Mulai dari Dashboard** — tawarkan **2–3 arah visual** berbeda (mis. "minimal-airy",
   "bold-fintech", "data-rich-clean") agar bisa dipilih.
3. Setelah arah dipilih, **kembangkan ke layar lain** (Riset Saham & Portofolio prioritas).
4. Sertakan **style guide ringkas**: palet warna (hex), tipografi, spacing, radius,
   shadow, dan contoh komponen (button/card/badge/table).
5. Pastikan **tanpa emoji**, konvensi hijau-naik/merah-turun, dan locale angka Indonesia.

> Catatan: backend (data IHSG, portofolio, alert, berita) sudah ada di Python; kamu cukup
> fokus pada **desain & front-end**. Buat sebagus mungkin — tujuannya jauh melampaui versi
> Streamlit yang flat sebelumnya.

---

## 8. Hindari
Tampilan flat tanpa kedalaman; warna norak/kontras buruk; emoji; tabel/teks polos tanpa
hierarki; angka non-locale; ikon tidak konsisten; whitespace berantakan.
