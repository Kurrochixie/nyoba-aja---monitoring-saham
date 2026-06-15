# Saham Monitor

Terminal pemantau saham Indonesia (IHSG/IDX) — aplikasi **lokal & pribadi**
berbasis Streamlit, bertema "IDX Terminal" gelap. Arsitektur multi-sumber yang
mudah diperluas (lihat [`../BLUEPRINT.md`](../BLUEPRINT.md) & [`../UI_REDESIGN_SPEC.md`](../UI_REDESIGN_SPEC.md)).

## Fitur

| Halaman | Isi |
|---|---|
| **Dashboard** | Ticker tape berjalan, KPI cards (IHSG + penggerak terbesar), watchlist + sparkline tren, status pasar, auto-refresh, grafik (Plotly/TradingView) |
| **Riset Saham** | Ringkasan, Fundamental (PER/PBV/ROE/dividen…), Analisis Teknikal (candlestick + SMA/Bollinger + RSI + MACD + sinyal agregat), Berita per emiten |
| **Portofolio** | Catat transaksi (lot, fee otomatis), posisi WAC, P/L realized & unrealized (IDR), alokasi (donut), pertumbuhan NAV + metrik (return/MDD/Sharpe) |
| **Alert** | Rule harga / %perubahan, edge-trigger + cooldown, notifikasi in-app + Telegram + desktop, riwayat |
| **Berita** | Feed RSS Indonesia (Google News + outlet), skor sentimen Bahasa Indonesia, filter per emiten |
| **Pengaturan** | Watchlist, API key (realtime/fundamental/Telegram), status sumber data |

## Menjalankan

```powershell
cd "C:\Users\ALDONI\Downloads\Saham Monitor\saham-monitor"
.\.venv\Scripts\Activate.ps1
streamlit run app.py
```
Buka `http://localhost:8501`.

### Alert 24/7 (opsional, tanpa app terbuka)
```powershell
.\.venv\Scripts\Activate.ps1
python alerts_daemon.py
```
Atau jadwalkan via **Windows Task Scheduler** agar jalan otomatis.

## Data realtime

- **Default (gratis):** yfinance — harga **delayed ~15–20 menit**, tapi terus
  ter-update saat jam bursa. Aktifkan **Auto-refresh** di Dashboard agar terasa live.
- **Realtime sungguhan (opsional):** isi `GOAPI_KEY` (goapi.id, ada tier gratis)
  di **Pengaturan** → harga via GoAPI. `SECTORS_KEY` (sectors.app) untuk
  fundamental akurat. Tanpa key, app otomatis pakai yfinance.
- Notifikasi Telegram: isi `TG_TOKEN` & `TG_CHAT_ID` di Pengaturan.

## Struktur

```
saham-monitor/
├── app.py              # entrypoint (st.navigation) — router semua halaman
├── config.py           # konstanta, feed RSS, leksikon sentimen
├── utils.py            # format IDR/ID, jam bursa, mapping TradingView
├── storage.py          # SQLite: watchlist, transaksi, rules, alert, kv (key)
├── alerts_daemon.py    # daemon alert background (APScheduler)
├── providers/          # LAPISAN DATA (fallback chain)
│   ├── base.py · schema.py · registry.py · keys.py
│   ├── yfinance_provider.py      # gratis (default)
│   ├── goapi_provider.py         # realtime (butuh GOAPI_KEY)
│   └── sectors_provider.py       # fundamental (butuh SECTORS_KEY)
├── models/             # Quote, Fundamentals, ...
├── services/           # market · indicators · portfolio · news · alert
├── ui/                 # theme (CSS premium) + charts (Plotly/TradingView)
└── views/              # dashboard · research · portfolio · alerts · news · settings
```

## Menambah sumber data
Buat `providers/xxx_provider.py` turunan `Provider`, `register()` di
`providers/registry.py` (urutan = prioritas). UI & services tidak perlu diubah.

## Lisensi & etika
Kode ditulis dari nol untuk penggunaan pribadi. Fincept Terminal hanya referensi
arsitektur — tidak ada kode Fincept yang disalin. Bukan rekomendasi investasi.
