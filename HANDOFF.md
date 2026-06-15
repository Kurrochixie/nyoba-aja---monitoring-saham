# Saham Monitor — Dokumen Handoff Lengkap

Dokumen ini menjelaskan **seluruh fitur, flow detail, arsitektur, data, dan API**
aplikasi "Saham Monitor" (pemantau saham Indonesia/IHSG, pribadi/lokal) agar
developer atau AI lain bisa melanjutkan — terutama **membangun ulang front-end**.

Lokasi kode: `Saham Monitor/saham-monitor/`. Stack saat ini: **Python 3.14,
Streamlit 1.58, pandas 3.0, plotly, yfinance, ta, feedparser, APScheduler, plyer**.

---

## 0. RINGKASAN PALING PENTING UNTUK PENERUS

**Backend (lapisan data + logika) SUDAH BAGUS, TERUJI, dan FRAMEWORK-AGNOSTIC.**
Yang buruk adalah **lapisan UI (Streamlit)**. Rekomendasi kuat:

1. **PERTAHANKAN** seluruh `providers/`, `services/`, `storage.py`, `models/`,
   `config.py`, `utils.py`. Semua ini Python murni, tidak terikat Streamlit, dan
   sudah divalidasi (termasuk realtime GoAPI yang sudah dites dengan key asli).
2. **GANTI front-end Streamlit** dengan front-end web sungguhan untuk UI premium:
   **React/Next.js + Tailwind CSS + shadcn/ui** (atau Vue/SvelteKit), dengan ikon
   **lucide-react**, chart **lightweight-charts (TradingView)** atau **Recharts/ECharts**.
3. **Bungkus backend** dengan **FastAPI** tipis (endpoint REST) memanggil
   fungsi `services/*` yang sudah ada → konsumsi dari front-end React.

**Kenapa Streamlit gagal di sini (akar "bug di mana-mana"):**
- Font ikon **Material Symbols bawaan Streamlit GAGAL dimuat** di environment ini,
  sehingga ikon internal widget (tombol collapse sidebar, panah expander,
  direktif `:material/...:`) **muncul sebagai teks ligatur** seperti
  `keyboard_double_arrow_left`, `expand_more`, `arrow_drop_down`. Itu yang terlihat
  garbled di sidebar & expander.
- Styling Streamlit **terbatas** (hook CSS minim, komponen flat) → sulit dapat
  ornamen/komponen kaya. CSS kustom hanya menambal sebagian.
- Tema sempat dibuat 3x (dark terminal → dark premium → light fintech) tapi tetap
  terasa flat karena keterbatasan Streamlit, bukan karena tokens-nya salah.

> **Saran tegas: untuk kualitas UI level Robinhood/Bibit, jangan pakai Streamlit.**
> Pakai React + Tailwind + shadcn/ui. Backend Python di bawah ini tinggal dipakai ulang.

---

## 1. TUJUAN APLIKASI

Dashboard pribadi (single-user, lokal) untuk **memantau saham Indonesia (IHSG/IDX)**:
harga, grafik, watchlist, portofolio + untung/rugi, alert harga, fundamental, dan
berita + sentimen. Bukan untuk eksekusi order (read-only/monitoring). Mata uang IDR,
1 lot = 100 lembar. Bukan nasihat investasi.

---

## 2. ARSITEKTUR (4 LAPIS — pola dari studi Fincept Terminal)

```
UI (Streamlit views/)         <- GANTI dengan React/Next + Tailwind
   |
SERVICES (services/)          <- orkestrasi + cache + logika bisnis  [PERTAHANKAN]
   |
PROVIDERS (providers/)        <- sumber data + fallback chain        [PERTAHANKAN]
   |
SUMBER EKSTERNAL (yfinance / GoAPI / Sectors / RSS)
```
Aturan: UI tidak pernah memanggil provider/sumber langsung — selalu lewat services.
Tambah sumber data baru = buat 1 kelas Provider + register() di registry. Tanpa ubah UI.

Penyimpanan durable: **SQLite** (`data/app.db`). Cache cepat: `st.cache_data` (di
React/FastAPI nanti diganti cache biasa/Redis/TTL).

---

## 3. PETA FILE

```
saham-monitor/
├── app.py                  # entry Streamlit (st.navigation, inject CSS)
├── config.py               # konstanta: watchlist default, TTL, jam bursa, fee,
│                           #   periode chart, RSS feeds, leksikon sentimen, nama emiten
├── utils.py                # format IDR/ID, jam bursa (WIB), normalize_symbol,
│                           #   to_tv_symbol (mapping TradingView), warna naik/turun
├── storage.py              # SQLite: skema + CRUD (watchlist, txn, rules, alert, kv, meta)
├── alerts_daemon.py        # daemon alert 24/7 (APScheduler, self-contained)
│
├── models/
│   ├── quote.py            # dataclass Quote (price, prev_close, OHLV, change, change_pct)
│   └── fundamentals.py     # dataclass Fundamentals (PER, PBV, ROE, dividend, sektor, ...)
│
├── providers/              # LAPISAN DATA
│   ├── base.py             # Provider ABC + ProviderResult (envelope ok/error_code)
│   ├── schema.py           # normalize_history (OHLCV standar)
│   ├── keys.py             # ambil API key dari kv SQLite lalu st.secrets
│   ├── registry.py         # daftar provider + for_symbol() (fallback chain)
│   ├── yfinance_provider.py# GRATIS default (delayed ~10-20 mnt) — .JK, ^JKSE
│   ├── goapi_provider.py   # REALTIME (butuh GOAPI_KEY) — TERVALIDASI, lihat §8
│   └── sectors_provider.py # fundamental (butuh SECTORS_KEY, v2 JWT) — eksperimental
│
├── services/               # ORKESTRASI + LOGIKA
│   ├── market_service.py   # quote/history/intraday/fundamentals + cache + fallback
│   ├── indicators.py       # SMA/EMA/RSI/MACD/Bollinger + ringkasan sinyal (pakai `ta`)
│   ├── portfolio_service.py# build_positions (WAC), P/L realized+unrealized, NAV, metrik
│   ├── news_service.py     # ambil RSS, parsing, skor sentimen Bahasa Indonesia
│   └── alert_service.py    # evaluasi rule (edge-trigger+cooldown), kirim notif
│
├── ui/
│   ├── theme.py            # CSS + helper komponen HTML (akan dibuang bila ganti React)
│   └── charts.py           # Plotly (candlestick, tech multi-panel, donut, NAV) + sparkline SVG
│
├── views/                  # HALAMAN (Streamlit) — yang akan dibangun ulang
│   ├── dashboard.py
│   ├── research.py
│   ├── portfolio.py
│   ├── alerts.py
│   ├── news.py
│   └── settings.py
│
└── data/                   # app.db (SQLite) + cache/ (parquet, dipakai nanti)
```

---

## 4. FITUR & FLOW DETAIL PER HALAMAN

### 4.1 Dashboard (`views/dashboard.py`)
**Tujuan:** ringkasan pasar + watchlist + chart 1 instrumen.

**Komponen & flow:**
1. **Sidebar kontrol:** toggle "Auto-refresh harga" + slider interval (15/30/60 dtk).
   Bila ON → bagian live di-rerun otomatis via `st.fragment(run_every=interval)`.
2. **Ticker tape** (marquee berjalan) berisi semua simbol watchlist: kode, harga, %.
   Data lokal (dari quote), looping mulus.
3. **Status bar:** status bursa (BUKA/TUTUP, dihitung dari jam WIB di `utils.is_market_open`),
   jam update, label sumber data (`market_service.primary_source_label()`:
   "GoAPI · realtime" bila ada key, else "yfinance · delayed ~15–20 mnt").
4. **Evaluasi alert otomatis:** tiap refresh memanggil `alert_service.evaluate(quotes)`;
   alert yang terpicu tampil sebagai toast.
5. **Ringkasan Pasar (KPI cards):** IHSG (^JKSE) + 3 saham penggerak terbesar
   (sort by |%change|). Tiap kartu: nama, kode, harga, Δ, Δ%.
6. **Watchlist (tabel):** Kode, Nama, **sparkline tren 30 hari** (SVG dari history 1mo),
   Terakhir, Δ, Δ%, Volume. Warna hijau/merah.
7. **Detail Instrumen:** selectbox pilih simbol + segmented "Sumber chart"
   (Plotly lokal / TradingView embed) + segmented periode (1B/3B/6B/1T/3T/5T).
   Tampilkan 4 metrik (Terakhir/Tertinggi/Terendah/Volume) + chart candlestick.

**Data dipakai:** `market_service.get_quotes(symbols)`, `get_history(sym, period)`,
`get_quote_obj(sym)`; `storage.get_watchlist()`.

### 4.2 Riset Saham (`views/research.py`)
**Tujuan:** analisa mendalam 1 emiten. 4 tab.

**Flow:** pilih emiten (selectbox dari watchlist) atau ketik kode bebas → normalisasi
(`utils.normalize_symbol`, tambah `.JK`). Ambil quote, fundamentals, name.

- **Tab Ringkasan:** KPI harga (Terakhir/Tertinggi/Terendah/Volume) + KPI valuasi
  (Kapitalisasi, PER, PBV, Dividend Yield) + rentang 52 minggu + sektor.
- **Tab Fundamental:** tabel metrik (sektor, industri, market cap, PER, PBV, EPS,
  book value, dividend yield, ROE, net margin, DER, beta). Sumber: `get_fundamentals`.
- **Tab Analisis Teknikal:** segmented periode → ambil history → `indicators.enrich`
  (SMA20/50/200, EMA20, RSI14, MACD, Bollinger) → **sinyal agregat** (BULLISH/NETRAL/
  BEARISH dari `indicators.signals` + `verdict_overall`) + **signal chips**
  (RSI, Harga vs SMA50, SMA50 vs SMA200 golden/death cross, MACD) + **chart multi-panel**
  (candlestick+SMA+Bollinger / volume / RSI / MACD).
- **Tab Berita:** `news_service.fetch_for_query("{nama} saham")` → rollup sentimen
  (positif/negatif/netral) + daftar kartu berita.

### 4.3 Portofolio (`views/portfolio.py`)
**Tujuan:** catat transaksi & lihat P/L.

**Flow:**
1. **Form Catat Transaksi:** Tanggal, Kode, Tipe (BUY/SELL), Lot, Harga/lembar, Fee.
   Fee bila 0 → dihitung otomatis (BUY 0.15% / SELL 0.25% dari nilai). Simpan →
   `storage.add_transaction` (shares = lot × 100).
2. **build_positions (WAC):** dari semua transaksi hitung per simbol:
   - BUY: cost += shares×price + fee; shares += shares.
   - SELL: realized += shares×price − avg×shares − fee; cost −= avg×shares; shares −= shares.
   - avg = cost/shares (weighted average cost).
   - Posisi terbuka: market = shares×harga_kini; unrealized = market − cost.
3. **KPI:** Nilai Pasar (+Δ hari ini), Total Modal, P/L Belum Terealisasi (+%),
   P/L Terealisasi.
4. **Tabel posisi:** Kode, Nama, Lot, Avg, Terakhir, Nilai, P/L, P/L%, Bobot.
5. **Alokasi:** donut by nilai pasar. **NAV:** `portfolio_service.nav_series` (replay
   transaksi terhadap close historis) + metrik (Return, Max Drawdown, Sharpe pakai
   rf IDR 6.5%).
6. **Riwayat transaksi:** daftar + tombol hapus.

### 4.4 Alert (`views/alerts.py`)
**Tujuan:** alert harga/%perubahan.

**Flow:**
1. **Buat rule:** Instrumen, Metrik (Harga / Perubahan harian %), Kondisi (>=,<=,>,<),
   Nilai, Cooldown (mnt), Kanal (app/telegram/desktop). Simpan → `storage.add_rule`.
2. **Engine (`alert_service.evaluate`):** untuk tiap rule aktif, bandingkan nilai kini
   vs threshold. **Edge-trigger:** fire sekali saat kondisi jadi benar → disarm; re-arm
   saat kondisi tidak lagi benar. **Cooldown** mencegah spam. Saat fire → simpan event +
   kirim notif sesuai kanal.
3. **Kanal:** in-app toast (saat app terbuka); **Telegram** (butuh TG_TOKEN+TG_CHAT_ID);
   **desktop** (plyer). Untuk 24/7 tanpa app: jalankan `alerts_daemon.py` (APScheduler,
   cek tiap 60 dtk, baca DB & key sendiri).
4. **UI:** tombol "Cek alert sekarang", daftar rule (toggle aktif/hapus), riwayat pemicu,
   status kanal.

### 4.5 Berita (`views/news.py`)
**Tujuan:** feed berita + sentimen.

**Flow:** pilih sumber ("Pasar (umum)" atau per-emiten). Umum → `fetch_general`
(Google News RSS + Detik Finance + CNBC Indonesia). Per-emiten → `fetch_for_query`
(Google News RSS query "{nama} saham"). Tiap item diberi skor sentimen via leksikon
Bahasa Indonesia (`config.POS_WORDS`/`NEG_WORDS`). Tampilkan rollup (positif/negatif/
netral) + bar proporsi + kartu berita (judul, sumber, waktu, badge sentimen, link).

### 4.6 Pengaturan (`views/settings.py`)
- **Watchlist:** tambah (validasi via quote) / hapus instrumen.
- **Koneksi data & notifikasi:** input `GOAPI_KEY` (realtime), `SECTORS_KEY`
  (fundamental v2), `TG_TOKEN`, `TG_CHAT_ID`. Disimpan ke tabel `kv` SQLite
  (atau via `.streamlit/secrets.toml`). Tampilkan sumber aktif + tes Telegram.
- **Info:** status realtime/delayed, TTL, mata uang/lot/fee, path DB, cara jalankan daemon.

---

## 5. SKEMA DATABASE (SQLite — `data/app.db`)

```sql
instrument_meta(symbol PK, name, currency, exchange, sector, updated_at)
watchlist(symbol PK, added_at)
transactions(id PK, date, symbol, type[BUY/SELL], lots, shares, price, fee, notes)
snapshots(portfolio_id, date, total_value, cost_basis, pnl, PK(portfolio_id,date))
rules(id PK, name, symbol, metric[price/change_pct], op, value, cooldown_min,
      channel, active, created_at)
rule_state(rule_id PK, armed, last_fired)         -- untuk edge-trigger + cooldown
alert_events(id PK, rule_id, symbol, detail, fired_at, delivered)
kv(k PK, v)                                        -- API key & preferensi lokal
```

---

## 6. MODEL DATA

- **Quote** (`models/quote.py`): symbol, price, previous_close, open, day_high, day_low,
  volume, currency, market_cap, source. Properti: `change`, `change_pct`.
- **Fundamentals** (`models/fundamentals.py`): symbol, name, sector, industry,
  market_cap, per, pbv, eps, book_value, dividend_yield, roe, de_ratio, profit_margin,
  week52_high/low, beta, currency, source, raw.
- **Transaksi**: belum ada dataclass; berupa row SQLite `transactions` (lihat §5).

---

## 7. LAPISAN PROVIDER (fallback chain)

`market_service` mengiterasi `registry.providers()` berurutan; pakai hasil sukses
pertama. Urutan: **goapi (realtime, jika key) → sectors (fundamental, jika key) →
yfinance (catch-all gratis)**. Tiap provider `supports(symbol)` menentukan aktif/tidak
(mis. goapi hanya aktif bila ada GOAPI_KEY & simbol `.JK`).

- **yfinance**: quote via `fast_info`, history via `Ticker.history`, fundamentals via
  `.info`. Simbol: saham `BBCA.JK`, indeks IHSG `^JKSE`. Delayed ~10–20 mnt. Gratis.
- **GoAPI**: realtime IDX (lihat §8). **Sectors v2**: fundamental (JWT, eksperimental).

---

## 8. API EKSTERNAL (TERVALIDASI)

### GoAPI.io — harga realtime IDX (sudah dites dengan key asli, BERFUNGSI)
- Base: `https://api.goapi.io/stock/idx`
- Auth: **query param** `?api_key=<KEY>`
- Endpoint quote: `GET /prices?symbols=BBCA&api_key=KEY` (multi: `symbols=BBRI,BBCA`)
- Contoh respons:
```json
{"status":"success","data":{"results":[{"symbol":"BBCA",
"company":{"symbol":"BBCA","name":"Bank Central Asia Tbk.","logo":"..."},
"date":"2026-06-15","open":6100,"high":6250,"low":6100,"close":6175,
"volume":76289800,"change":250,"change_pct":4.22}]}}
```
- Parsing: price = `close`; previous_close = `close − change`; ambil open/high/low/volume.
- Endpoint lain (dari SDK resmi): `/companies`, `/indices`, `/{sym}/profile`,
  `/{sym}/historical?from=&to=`, `/trending`, `/top_gainer`, `/top_loser`,
  `/{sym}/broker_summary?date=`.
- Catatan: indeks IHSG TIDAK lewat `/prices` (saham saja) — pakai `/indices` atau yfinance `^JKSE`.

### Sectors.app — fundamental (v2, eksperimental)
- API v1 SUDAH DIHENTIKAN (Mei 2026). v2: base `https://api.sectors.app/v2`,
  endpoint `GET /company/report/{TICKER}/` (trailing slash wajib),
  auth **JWT**: header `Authorization: Bearer <token>`. Response shape v2 belum
  diverifikasi (parser dibuat defensif). Fundamental sudah cukup dari yfinance.

### Telegram (notifikasi alert)
- `POST https://api.telegram.org/bot<TG_TOKEN>/sendMessage` body `{chat_id, text}`.

### RSS Berita (gratis)
- Google News: `https://news.google.com/rss/search?q=<query>&hl=id&gl=ID&ceid=ID:id`
- Detik Finance: `https://finance.detik.com/rss`
- CNBC Indonesia Market: `https://www.cnbcindonesia.com/market/rss`

---

## 9. PENILAIAN SUMBER DATA IDX (ringkas)

Realtime IDX gratis-legal-andal **tidak ada sekaligus**. Plafon hemat = delayed ~10–20 mnt.
Rekomendasi: **GoAPI (primary, tier gratis, near-realtime) + yfinance (fallback)**.
Detail lengkap + tabel skor ada di `Saham Monitor/IDX_DATA_ASSESSMENT.md`.

---

## 10. INDIKATOR & RUMUS PENTING

- **Teknikal** (`services/indicators.py`, lib `ta`): SMA(20,50,200), EMA20, RSI(14),
  MACD(12,26,9), Bollinger(20,2). Sinyal: RSI>70 overbought / <30 oversold;
  Harga vs SMA50; SMA50 vs SMA200 (golden/death cross); MACD vs signal.
- **P/L** (`services/portfolio_service.py`): WAC; realized saat SELL; unrealized =
  market − cost; lot×100; fee BUY 0.15%/SELL 0.25%. NAV = replay shares×close harian.
  Metrik: return total, max drawdown, Sharpe (rf IDR 6.5%/252).
- **Sentimen berita**: leksikon ID (skor = jumlah kata positif − negatif).

---

## 11. CARA MENJALANKAN (saat ini, Streamlit)

```powershell
cd "C:\Users\ALDONI\Downloads\Saham Monitor\saham-monitor"
.\.venv\Scripts\Activate.ps1
streamlit run app.py            # http://localhost:8501
python alerts_daemon.py         # (opsional) alert 24/7
```

---

## 12. MASALAH YANG DIKETAHUI (untuk diperbaiki penerus)

1. **Ikon internal Streamlit = teks ligatur** (`keyboard_double_arrow_*`, `expand_more`,
   `arrow_drop_down`, direktif `:material/...:`). Font Material bawaan Streamlit tak
   termuat di environment ini. Workaround sementara: hindari widget ber-ikon internal,
   pakai Material Symbols via Google Fonts untuk HTML kustom. **Solusi sebenarnya: ganti
   ke React** (ikon lucide-react dijamin jalan).
2. **UI terasa flat/plain** — keterbatasan Streamlit (styling hook minim). Tidak akan
   pernah selevel app fintech native tanpa front-end sungguhan.
3. Realtime hanya jika user mengisi GOAPI_KEY; default delayed.

---

## 13. REKOMENDASI ARSITEKTUR TARGET (untuk UI premium)

```
Frontend:  Next.js (React) + TypeScript + Tailwind CSS + shadcn/ui
           + lucide-react (ikon) + lightweight-charts / Recharts (grafik)
           + TanStack Query (fetch+cache) + Zustand (state)
Backend:   FastAPI (Python) — bungkus services/* jadi REST:
             GET /quote?symbols=...           -> market_service.get_quotes
             GET /history?symbol=&period=     -> market_service.get_history
             GET /fundamentals?symbol=        -> market_service.get_fundamentals
             GET /indicators?symbol=&period=  -> indicators.enrich + signals
             CRUD /watchlist /transactions /rules
             GET /portfolio                   -> portfolio_service.build_positions
             GET /news?symbol=                -> news_service
           Reuse providers/ services/ storage.py APA ADANYA.
DB:        SQLite (cukup) atau Postgres bila perlu.
Realtime:  polling TanStack Query (refetchInterval) atau WebSocket dari FastAPI.
```
Dengan ini, semua logika Python yang sudah teruji dipakai ulang, dan UI dibangun di
ekosistem web yang memang dirancang untuk tampilan kaya — sesuai kualitas yang Anda mau.

---

*Dokumen pendukung lain di folder `Saham Monitor/`: `BLUEPRINT.md` (arsitektur awal),
`UI_REDESIGN_SPEC.md` (riset UI), `IDX_DATA_ASSESSMENT.md` (penilaian sumber data).*
