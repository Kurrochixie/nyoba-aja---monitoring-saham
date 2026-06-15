# Penilaian Sumber Data Saham IDX untuk App Pemantau IHSG Pribadi

## 1. Ringkasan Eksekutif

Untuk app pemantau IHSG **pribadi, single-user, lokal**, kombinasi terbaik adalah **vendor lokal resmi ber-tier-gratis (GoAPI.io atau Invezgo) sebagai PRIMARY untuk harga near-realtime + yfinance sebagai FALLBACK**, dengan **Sectors.app v2 (berbayar)** ditambahkan hanya jika butuh fundamental rapi. Tidak ada solusi "realtime + gratis + legal + andal" sekaligus — itu mustahil secara struktural, karena **realtime IDX sejati hanya tersedia via lisensi IDX Data Services (B2B, mahal) atau di dalam aplikasi broker berlisensi**; jadi plafon realistis yang hemat & legal adalah **delayed ~10-20 menit**, yang sudah lebih dari cukup untuk monitoring non-trading.

## 2. Tabel Skor

Skala 1-5 (5 = terbaik). **Skor total** memakai bobot: Keandalan x2, Legalitas x2, Realtime x1, Cakupan IDX x1, Biaya/aksesibilitas x1, Kemudahan integrasi x1 (maks = 8x5 = 40). Keandalan & legalitas dibobot ganda karena ini app untuk pemantauan finansial yang harus dipercaya.

| Kandidat | Realtime | Keandalan (x2) | Cakupan IDX | Biaya/aksesibilitas | Legalitas (x2) | Kemudahan integrasi | **Skor total /40** | Catatan |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **GoAPI.io** | 3 | 4 | 4 | 5 | 4 | 5 | **37** | Snapshot near-realtime, tier GRATIS, REST JSON, vendor lokal resmi. Sumber data mungkin relay web IDX (abu-abu ringan). Pemenang praktis. |
| **Invezgo** | 3 | 4 | 5 | 4 | 4 | 4 | **36** | Cakupan IDX terdalam (fundamental XBRL, KSEI, foreign flow). API butuh "Developer package" berbayar (harga tak publik). |
| **yfinance** | 3 | 2 | 5 | 5 | 3 | 5 | **32** | Delayed ~10 mnt, cakupan .JK & ^JKSE penuh, gratis. RAPUH (429, redesign Yahoo). Ideal sebagai FALLBACK, bukan primary. |
| **Sectors.app v2** | 1 | 4 | 5 | 3 | 5 | 5 | **32** | Paling rapi & legal-friendly, tapi HANYA harian/EOD. Untuk fundamental + indeks, bukan harga live. v1 sudah discontinued. |
| **OHLC.dev** | 3 | 3 | 4 | 4 | 3 | 4 | **30** | Harga jelas ($15/bln), cakupan lebar (bonds/warrants), tapi realtime di-disclaim sendiri. Via RapidAPI. |
| **TradingView** (widget) | 4 | 5 | 4 | 4 | 3 | 3 | **34** | Display realtime/15-mnt-delayed andal, TAPI ToS LARANG ambil angka untuk logika/alert ("non-display use"). Hanya untuk chart visual, bukan sumber angka. |
| **Twelve Data (XIDX)** | 1 | 4 | 3 | 2 | 5 | 4 | **29** | IDX hanya EOD + butuh Pro+/Venture+ berbayar. Manfaat di atas yfinance kecil. |
| **Broker API IDX** | 5 | 4 | 5 | 3 | 5 | 2 | **35*** | *Tidak ada broker retail dengan API publik resmi. Skor ini hipotetis. Realtime sah HANYA via wrapper Stockbit tak resmi (rapuh, langgar ToS, rate-limit ~40 req/5mnt) atau lisensi IDX B2B. |
| **Scraping** (Investing/RTI/WSJ) | 3 | 1 | 4 | 5 | 1 | 1 | **20** | Paling rapuh. Cloudflare anti-bot, silent failure, langgar ToS. HINDARI. |

\* Catatan broker: skor 35 mengasumsikan adanya API resmi yang tidak ada di realita pasar IDX. Jalur realtime broker yang ada (wrapper Stockbit) realistis skornya jatuh ke ~24 begitu kerapuhan & legalitas abu-abu diperhitungkan.

## 3. Rekomendasi Berperingkat

### Terbaik
- **GoAPI.io (PRIMARY harga)** — Sweet spot: tier gratis untuk mulai, REST JSON gampang dipasang di Streamlit, vendor lokal yang relay data IDX, near-realtime snapshot. Cukup untuk 90% kebutuhan monitoring tanpa biaya/legal ribet.
- **yfinance (FALLBACK)** — Pertahankan, jangan dibuang. Jaring pengaman saat GoAPI down/kuota habis. Delay ~10 menit (resmi per Yahoo, sumber ICE Data Services — lebih cepat dari asumsi 15-20 mnt).

### Alternatif (sesuai kebutuhan)
- **Invezgo** — Bila butuh fundamental dalam (XBRL, kepemilikan KSEI, foreign flow) dan rela bayar kecil untuk Developer package. Cakupan IDX paling lengkap.
- **Sectors.app v2** — Bila prioritas = fundamental + indeks + market cap historis yang RAPI & legal, dan TIDAK butuh harga live. Tambahkan di samping sumber harga, bukan menggantikannya.
- **TradingView widget** — Hanya untuk menampilkan chart IHSG/saham (embed). JANGAN tarik angkanya untuk alert/logika (langgar ToS).
- **OHLC.dev** — Bila mau biaya pasti ($15/bln) + cakupan luas termasuk obligasi/warrant.

### Hindari
- **Scraping (Investing.com, RTI, WSJ/MarketWatch)** — Rapuh, langgar ToS, silent failure berbahaya untuk data finansial. Tidak lebih baik dari yfinance yang lebih bersih.
- **Polygon.io** — TIDAK cover IDX sama sekali. Coret.
- **Finnhub, Marketstack, Tiingo, Alpha Vantage** — Cakupan IDX tidak terkonfirmasi/lemah, paling banter EOD, free tier tidak buka IDX. Tidak sepadan.
- **Twelve Data** — Hanya jika sudah memakainya untuk aset lain & cukup data IDX harian; untuk realtime IDX tidak berguna.
- **Wrapper Stockbit tak resmi** — Walau ini jalur realtime gratis paling realistis, abu-abu (langgar ToS, risiko suspend akun) & rapuh. Hanya jika Anda terima risiko penuh dan punya fallback.
- **IDX Data Services resmi** — Secara teknis terbaik & paling terpercaya, tapi model lisensi B2B/kontrak, mahal, butuh badan usaha. Overkill untuk app pribadi.

## 4. Rekomendasi Arsitektur untuk App Ini

**Fallback chain (urutan eksekusi):**
```
PRIMARY:   GoAPI.io (harga/quote near-realtime, tier gratis)
   ↓ (gagal/kuota habis)
FALLBACK:  yfinance (.JK, ^JKSE — delayed ~10 mnt)
   ↓ (gagal)
TAMPILKAN: "data tidak tersedia" (JANGAN tampilkan angka basi tanpa label)

PELENGKAP (jalur terpisah, boleh gagal anggun):
   - Fundamental/indeks rapi  → Sectors.app v2 (berbayar) atau Invezgo
   - Chart visual             → TradingView widget embed (display only)
```

**Prinsip implementasi:**
- **Abstraksi provider** di balik satu interface, agar 1 sumber putus tak merobohkan app.
- **TTL cache agresif** (pakai `st.cache_data`): quote 30-60 detik, history harian, fundamental harian, berita 10-15 menit — untuk hemat kuota gratis & hindari rate-limit.
- **Status-source indicator jujur**: badge `REALTIME` vs `DELAYED (~10 mnt)` per data, jangan menyesatkan user.
- **Pisahkan jalur "harga inti" (harus andal) dari "nice-to-have" (boleh gagal anggun)** — fundamental Stockbit/scraping, kalau dipakai, isolasi total sebagai modul opsional.
- **Defensive coding per provider**: timeout pendek, retry + exponential backoff, deteksi None/kosong, circuit-breaker (skip sementara provider yang baru gagal).

**Kapan cukup gratis vs kapan upgrade berbayar:**
- **Cukup gratis** (GoAPI free + yfinance): monitoring & swing-trade, delay 10 menit dapat diterima, watchlist kecil-menengah. Ini mayoritas kasus.
- **Upgrade berbayar** saat: (a) kuota free tier GoAPI sering habis; (b) butuh fundamental lengkap → Invezgo/Sectors; (c) butuh tick realtime sungguhan untuk day-trading/scalping → tidak ada jalur murah, pertimbangkan buka rekening broker & pakai app brokernya langsung untuk eksekusi.

**Perkiraan biaya:**
- **Rp 0/bulan** — GoAPI free tier + yfinance (titik awal yang disarankan).
- **~Rp 40.000-80.000/bulan** — langganan konsumen Invezgo (tapi akses API butuh Developer package terpisah, harga tak dipublikasi — wajib kontak).
- **~$15/bulan (~Rp 240rb)** — OHLC.dev Pro (biaya pasti, cakupan luas).
- **Sectors.app v2 Insider** — harga tak terkonfirmasi (halaman pricing 403 saat riset), wajib cek langsung.
- **EUR 19,99-59,99/bulan** — EODHD bila butuh fundamental + historis IDX legal (tapi IDX = delayed, bukan realtime).

## 5. Langkah Berikutnya (Bisa Langsung Dieksekusi)

1. **Daftar GoAPI.io free tier** di goapi.io → ambil API key → uji 1 endpoint snapshot harga (mis. BBCA) di Streamlit. Bandingkan angka & freshness-nya vs yfinance.
2. **Verifikasi arti "realtime" GoAPI**: ukur selisih waktu vs harga resmi IDX/RTI Business pada jam bursa. Catat delay aktual (klaim vendor tidak transparan soal menit).
3. **Refactor app ke pola fallback chain**: GoAPI primary → yfinance fallback, di balik satu interface provider. Tambahkan `st.cache_data` dengan TTL sesuai jenis data.
4. **Tambahkan badge status-source** (REALTIME/DELAYED) yang jujur di UI.
5. **Hardening yfinance**: pin versi, tambah retry + exponential backoff, tangani error 429 & data kosong.
6. **(Opsional) Bila butuh fundamental**: minta quote harga API Invezgo Developer package ATAU cek pricing Sectors.app v2 Insider langsung. Putuskan berdasarkan biaya nyata.
7. **(Opsional) Chart**: embed widget TradingView (IDX:BBCA, ^JKSE) untuk visual — tanpa menarik angkanya ke logika app.

## 6. Catatan Ketidakpastian / Perlu Diverifikasi

- **Arti "realtime" GoAPI & Invezgo tidak transparan** — keduanya tidak menyebut besar delay dalam menit. Realistis ini snapshot near-realtime (polling), bukan tick streaming. **Verifikasi sendiri** sebelum mengandalkan untuk keputusan sensitif.
- **Harga API tidak terpublikasi penuh**: kuota free tier GoAPI, harga Developer package Invezgo, dan tier Insider Sectors.app (halaman pricing 403 saat riset) semuanya **harus dikonfirmasi langsung**.
- **Legalitas sumber data vendor lokal abu-abu ringan**: GoAPI/Invezgo kemungkinan me-relay/redistribusi data web publik IDX; tidak ada pernyataan publik bahwa mereka authorized vendor IDX. Untuk pemakaian **pribadi non-redistribusi**, risiko rendah; jangan redistribusi datanya.
- **Delay yfinance**: dilaporkan ~10 menit (resmi Yahoo, sumber ICE Data Services), lebih cepat dari asumsi awal 15-20 menit — tapi perilaku breakage/rate-limit bervariasi per waktu & IP.
- **Tidak ada broker retail IDX dengan API market-data realtime resmi & publik** untuk perorangan — temuan ini perlu dicek ulang berkala karena lanskap bisa berubah.
- **Kerapuhan wrapper Stockbit**: endpoint internal bisa diblok kapan saja tanpa pemberitahuan; klaim rate-limit ~40 req/5mnt dari sumber komunitas, bukan dokumentasi resmi.
- Semua harga & limit free tier **dapat berubah cepat** — penilaian ini per Juni 2026; cek ulang halaman pricing masing-masing sebelum implementasi.