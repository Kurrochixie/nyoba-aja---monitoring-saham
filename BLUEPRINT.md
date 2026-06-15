# Blueprint Arsitektur & Referensi: Personal IHSG Monitor (Streamlit)

> Dokumen referensi pembelajaran untuk membangun dashboard pemantau saham Indonesia (IHSG) lokal berbasis Streamlit. Disusun dari dissection arsitektur Fincept Terminal. **Anda mengimplementasikan ulang ide-idenya dari nol — JANGAN menyalin kode Fincept** (lihat Bagian 10: Lisensi & Etika).

---

## 1. Ringkasan & Tujuan

### Tujuan
Membangun **aplikasi pribadi, lokal, single-user** untuk memantau saham IDX dengan empat fitur inti:

1. **Harga & grafik / watchlist** — quote real-ish (delayed), candlestick chart, daftar pantau.
2. **Portofolio & P/L** — ledger transaksi, posisi (WAC), P/L unrealized + realized, metrik risiko.
3. **Alert & notifikasi** — rule berbasis threshold/indikator, edge-trigger + cooldown, push ke Telegram/desktop.
4. **Fundamental & berita** — laporan keuangan, rasio, verdict heuristik, feed berita + sentimen.

### Filosofi desain (diadaptasi dari Fincept)
- **Pemisahan lapisan tegas**: UI tidak pernah memanggil sumber data langsung. UI → service → provider → source.
- **Multi-source extensible**: yfinance sebagai sumber awal, tapi arsitektur provider memungkinkan menambah Sectors.app, GoAPI.io, lalu crypto/global/macro **tanpa mengubah UI**.
- **Cache berlapis dengan TTL berbeda per tipe data**: harga (detik), fundamental (menit), nama/currency (persisten).
- **Normalized schema**: setiap sumber dipetakan ke bentuk yang sama, sehingga UI tidak tahu/peduli sumber asalnya.

### Perbedaan kunci vs Fincept (yang menguntungkan Anda)
| Aspek | Fincept | Aplikasi Anda |
|---|---|---|
| UI | C++/Qt native | Streamlit (Python murni) |
| Bridge data | subprocess Python + JSON-over-stdout + daemon | **panggilan library in-process** + `st.cache_*` |
| Concurrency | QProcess pool (cap 3) + Qt signals | `st.cache_data` + `ThreadPoolExecutor` opsional |
| Cache durable | SQLite `CacheManager` | SQLite + Parquet (karena `st.cache_data` hilang saat restart) |
| Skala | multi-broker, ~60 sumber, global | personal, IHSG-first, read-only |

**Implikasi besar**: Anda **membuang seluruh kompleksitas subprocess/daemon/IPC** Fincept. Karena Streamlit adalah Python, Anda memanggil `yfinance` langsung. Yang Anda pertahankan adalah **pola arsitekturalnya** (layering, cache-first, normalized schema, edge-trigger alert).

---

## 2. Pelajaran Arsitektur dari Fincept → Padanan Streamlit

### 2.1 Layering Fincept (4 lapis)

```
┌─────────────────────────────────────────────┐
│  UI SCREENS (Qt widgets, DockScreenRouter)   │  ← tidak tahu apa-apa soal Python/sumber
├─────────────────────────────────────────────┤
│  SERVICES (EquityResearchService, dll)       │  ← singleton, cache-first, parse→struct, signal
├─────────────────────────────────────────────┤
│  PROVIDER BRIDGE (PythonRunner/PythonWorker) │  ← subprocess pool, daemon, extract_json()
├─────────────────────────────────────────────┤
│  PYTHON SCRIPTS (yfinance_data.py, dll)      │  ← fetch raw → emit 1 baris JSON ke stdout
└─────────────────────────────────────────────┘
                      ↓
              EXTERNAL SOURCE (Yahoo, FRED, ...)
```

Aturan emas Fincept: **UI never imports the data layer; it calls a service; the service is the only thing that knows about the provider and the cache.**

### 2.2 The Subprocess-JSON Bridge (dan kenapa Anda tidak membutuhkannya)

Fincept harus menjembatani C++ ↔ Python. Mekanismenya:
- **`PythonRunner`**: spawn `python yfinance_data.py quote BBCA.JK`, baca stdout, ambil **baris JSON terakhir yang valid** (`extract_json()`), parse ke struct.
- **Polusi stdout**: yfinance mencetak progress bar & log → mereka `redirect_stdout` + silence logger, dan parser hanya ambil baris terakhir yang dimulai `{` atau `[`.
- **Error by convention**: keberadaan key `"error"` di dalam JSON = gagal logis, **terpisah** dari exit code. Sukses = `exit_code==0 AND json non-empty AND tidak ada key "error"`.
- **Daemon mode**: proses Python long-lived (length-prefixed JSON frames) untuk menghindari cold-start import pandas/yfinance ~2-3 detik.
- **Arg-spill**: payload besar ditulis ke tempfile `@/path` karena batas command-line Windows ~32KB.

**Padanan Streamlit — semua ini LENYAP:**

| Masalah Fincept (lintas-proses) | Solusi Streamlit (in-process) |
|---|---|
| Spawn subprocess per request | Panggil `yf.Ticker(...)` langsung |
| `extract_json()` parsing baris terakhir | Tidak ada — dapat objek Python langsung |
| Cold-start import 2-3s → daemon | `@st.cache_resource` untuk session/client (dibuat sekali) |
| Polusi stdout | Cukup `logging.getLogger("yfinance").setLevel(CRITICAL)` |
| Arg-spill tempfile (batas 32KB) | Tidak ada — lewatkan list Python langsung |
| Concurrency cap (QProcess pool=3) | `@st.cache_data` + batch `yf.download(list)`; opsional `ThreadPoolExecutor(max_workers=3)` |
| Qt signals (async result) | Streamlit rerun model (sinkron top-to-bottom) |
| `CacheManager` (SQLite, durable) | `st.cache_data(ttl)` (session) **+** SQLite/Parquet (durable) |

### 2.3 Padanan konsep per-komponen

| Konsep Fincept | Padanan Streamlit Anda |
|---|---|
| `DockScreenRouter` (lazy screen + state save/restore) | folder `pages/` (multipage auto-routing) + `st.session_state` |
| `EquityResearchService` (cache-first loader, TTL, fallback) | modul `services/*.py` membungkus provider dengan `@st.cache_data(ttl=...)` |
| `CacheManager` (SQLite K/V, TTL, category, prefix-invalidate) | `st.cache_data` (volatile) + `storage.py` SQLite/Parquet (durable) |
| `DataHub` (pub/sub, per-topic TTL/policy, coalesce) | `st.cache_data` per `(symbol, period, interval)` = "topic"; refresh via `st.fragment(run_every=...)` atau tombol |
| `TopicPolicy` (pause_when_inactive, min_interval) | gating refresh ke jam bursa IDX + TTL |
| `ScriptCatalog` (nama logis → path) | `providers/registry.py` (nama provider → instance) |
| `PythonRunner` concurrency limiter | `@st.cache_data` + batch download (jarang butuh ThreadPool) |
| `IStatefulScreen` save/restore | `st.session_state['symbol']`, `['period']`, `['watchlist']` |

**Kunci memahami Streamlit**: skrip dijalankan ulang **top-to-bottom setiap interaksi**. Variabel module-level/global **direset** tiap rerun. Yang bertahan: `st.session_state` (per-session), `@st.cache_data`/`@st.cache_resource` (per-process), dan file di disk (SQLite/Parquet). Inilah sebabnya **state alert (armed, last_fired) WAJIB di session_state atau SQLite**, bukan variabel global.

---

## 3. Lapisan Data Multi-Sumber (paling detail)

Ini adalah inti yang membuat aplikasi Anda extensible. Tujuannya: **menambah sumber = menulis satu kelas Provider baru + `register()`, tanpa menyentuh UI**.

### 3.1 Empat komponen lapisan data

```
providers/
├── base.py        # Provider ABC + ProviderResult envelope
├── schema.py      # normalized schema (QUOTE/HISTORY/FUNDAMENTALS) + helper
├── yfinance_provider.py
├── (nanti) sectors_provider.py, goapi_provider.py, crypto_provider.py
└── registry.py    # daftar provider + pemilihan by-symbol
```

### 3.2 Base Provider (abstract class) + Result envelope

Pola Fincept yang ditiru: **uniform success/error shape** (key `error`/`error_code` dari `fred_data.py`), **typed model** terpisah dari fetch, dan **`supports()`** untuk routing simbol.

```python
# providers/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
import pandas as pd

# Mirror ide fred_data.py: error_code enum, bukan exception lintas-batas.
ERROR_CODES = {"OK", "NO_DATA", "RATE_LIMITED", "AUTH", "NETWORK", "BAD_SYMBOL", "UNKNOWN"}

@dataclass
class ProviderResult:
    """Envelope seragam. UI selalu cek .ok, tidak pernah lihat raw traceback."""
    ok: bool
    data: Any = None
    error_code: str = "OK"
    message: str = ""
    source: str = ""              # provider.name yang melayani
    meta: dict = field(default_factory=dict)

    @classmethod
    def success(cls, data, source, **meta):
        return cls(ok=True, data=data, source=source, meta=meta)

    @classmethod
    def fail(cls, code, msg, source=""):
        return cls(ok=False, error_code=code, message=msg, source=source)


class Provider(ABC):
    """Kontrak yang HARUS dipatuhi setiap sumber data.
    Method mengembalikan data ternormalisasi (lihat schema.py) ATAU raise;
    registry membungkus exception menjadi ProviderResult.fail(...)."""

    name: str = "base"
    asset_class: str = "equity"   # 'equity' | 'index' | 'crypto' | 'macro' ...
    priority: int = 100           # makin kecil makin diutamakan saat banyak yang supports()

    @abstractmethod
    def supports(self, symbol: str) -> bool:
        """True jika provider ini bisa melayani simbol (mis. endswith('.JK'))."""

    @abstractmethod
    def get_quote(self, symbol: str) -> dict:
        """Satu QUOTE dict ternormalisasi (lihat schema.QUOTE_KEYS)."""

    @abstractmethod
    def get_history(self, symbol: str, period: str = "6mo",
                    interval: str = "1d") -> pd.DataFrame:
        """HISTORY DataFrame ternormalisasi (DatetimeIndex 'date', kolom OHLCV lowercase)."""

    # Method opsional — default 'tidak didukung' agar provider minimal tetap valid.
    def get_fundamentals(self, symbol: str) -> dict:
        raise NotImplementedError

    def search(self, query: str, limit: int = 20) -> pd.DataFrame:
        raise NotImplementedError

    def get_news(self, symbol: str, limit: int = 20) -> list[dict]:
        raise NotImplementedError
```

### 3.3 Normalized Schema (kontrak bentuk data)

Pola Fincept: **fix nama field eksak** supaya setiap sumber dipetakan ke SATU bentuk, dan **NaN/Inf → None** (sanitasi `safe_call` dari akshare). Ini membuat UI/plotly/pandas-ta "tinggal jalan".

```python
# providers/schema.py
import pandas as pd
import numpy as np

# --- Kunci kanonik (samakan persis di semua provider) ---
QUOTE_KEYS = [
    "symbol", "name", "price", "change", "change_pct", "volume",
    "high", "low", "open", "prev_close", "currency", "ts",
]
FUNDAMENTALS_KEYS = [
    "symbol", "name", "sector", "industry", "market_cap", "pe", "forward_pe",
    "pbv", "dividend_yield", "eps", "roe", "de_ratio",
    "week52_high", "week52_low", "currency", "exchange",
    "profit_margin", "revenue_growth", "fcf", "total_debt", "book_value",
]
HISTORY_COLS = ["open", "high", "low", "close", "volume"]   # lowercase, urut tetap
SEARCH_COLS  = ["symbol", "name", "exchange", "type", "currency"]

JAKARTA_TZ = "Asia/Jakarta"

def normalize_history(df: pd.DataFrame) -> pd.DataFrame:
    """Ubah output mentah yfinance (kolom kapital, tz UTC) → schema kanonik.
    Mirror akshare safe_call: bersihkan NaN/Inf agar JSON/serialisasi aman."""
    if df is None or df.empty:
        return pd.DataFrame(columns=HISTORY_COLS,
                            index=pd.DatetimeIndex([], name="date"))
    df = df.rename(columns=str.lower)
    # yfinance kadang 'adj close' / 'stock splits' dst — ambil yang kita perlu saja
    keep = {c: c for c in HISTORY_COLS if c in df.columns}
    df = df[list(keep)].copy()
    # Index → tz Asia/Jakarta, beri nama 'date'
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    df.index = df.index.tz_convert(JAKARTA_TZ)
    df.index.name = "date"
    # Sanitasi NaN/Inf → None/NA (JSON tak bisa NaN/Inf)
    df = df.replace([np.inf, -np.inf], np.nan)
    return df

def empty_quote(symbol: str) -> dict:
    q = {k: None for k in QUOTE_KEYS}
    q["symbol"] = symbol
    return q

def safe(v):
    """Guard nilai tunggal: NaN/Inf → None (yfinance .info penuh None/NaN untuk saham tipis)."""
    try:
        if v is None or (isinstance(v, float) and (pd.isna(v) or np.isinf(v))):
            return None
    except TypeError:
        pass
    return v
```

### 3.4 YFinanceProvider (untuk `.JK` + `^JKSE`)

Menerapkan: **symbol resolution candidate** (Fincept lupa tambah `.JK` — kita tambahkan), **period ≥ 5d untuk change% benar**, **prev_close based change**, **guard field hilang**, **batch download**.

```python
# providers/yfinance_provider.py
import logging, time
import pandas as pd
import yfinance as yf
from .base import Provider
from .schema import (QUOTE_KEYS, FUNDAMENTALS_KEYS, SEARCH_COLS,
                     normalize_history, empty_quote, safe, JAKARTA_TZ)

logging.getLogger("yfinance").setLevel(logging.CRITICAL)  # senyapkan polusi log

# Index IDX tidak punya volume/fundamentals → harus di-guard.
INDEX_SYMBOLS = {"^JKSE", "^JKII", "^JKLQ45"}

class YFinanceProvider(Provider):
    name = "yfinance"
    asset_class = "equity"
    priority = 100   # provider default/fallback universal

    def supports(self, symbol: str) -> bool:
        s = symbol.upper()
        return s.endswith(".JK") or s in INDEX_SYMBOLS

    def _candidates(self, symbol: str) -> list[str]:
        """Fincept hanya coba '', .NS, .BO — TIDAK .JK. Kita perbaiki:
        bila simbol 'telanjang', coba '.JK' agar 'BBCA' → 'BBCA.JK'."""
        s = symbol.upper().strip()
        if s.startswith("^") or "." in s or "=" in s:
            return [s]                # sudah qualified
        return [s + ".JK", s]         # default IDX dulu

    def get_quote(self, symbol: str) -> dict:
        sym = self._candidates(symbol)[0]
        # period='5d' agar akhir pekan/libur tetap menyisakan >=2 baris (change% benar)
        hist = yf.Ticker(sym).history(period="5d", interval="1d")
        if hist is None or len(hist) < 1:
            return empty_quote(sym)
        last = hist.iloc[-1]
        prev = hist["Close"].iloc[-2] if len(hist) >= 2 else last["Close"]
        price = float(last["Close"])
        q = empty_quote(sym)
        q.update(
            price=price,
            prev_close=float(prev),
            change=price - float(prev),
            change_pct=((price - float(prev)) / float(prev) * 100) if prev else None,
            open=float(last["Open"]), high=float(last["High"]),
            low=float(last["Low"]),
            volume=int(last["Volume"]) if not pd.isna(last["Volume"]) else None,
            currency="IDR" if sym not in INDEX_SYMBOLS else None,
            ts=hist.index[-1].tz_convert(JAKARTA_TZ),
        )
        return q

    def get_history(self, symbol: str, period="6mo", interval="1d") -> pd.DataFrame:
        sym = self._candidates(symbol)[0]
        raw = yf.Ticker(sym).history(period=period, interval=interval)
        return normalize_history(raw)

    def get_fundamentals(self, symbol: str) -> dict:
        sym = self._candidates(symbol)[0]
        if sym in INDEX_SYMBOLS:
            raise NotImplementedError("Index tidak punya fundamentals")
        info = yf.Ticker(sym).info or {}
        # yfinance .info pakai camelCase; guard semua dengan safe()/get()
        dy = safe(info.get("dividendYield"))
        # CATATAN: unit dividendYield berubah antar versi (fraksi vs persen) — verifikasi!
        f = {k: None for k in FUNDAMENTALS_KEYS}
        f.update(
            symbol=sym, name=info.get("longName") or info.get("shortName"),
            sector=info.get("sector"), industry=info.get("industry"),
            market_cap=safe(info.get("marketCap")),
            pe=safe(info.get("trailingPE")), forward_pe=safe(info.get("forwardPE")),
            pbv=safe(info.get("priceToBook")),
            dividend_yield=dy, eps=safe(info.get("trailingEps")),
            roe=safe(info.get("returnOnEquity")),
            de_ratio=safe(info.get("debtToEquity")),
            week52_high=safe(info.get("fiftyTwoWeekHigh")),
            week52_low=safe(info.get("fiftyTwoWeekLow")),
            profit_margin=safe(info.get("profitMargins")),
            revenue_growth=safe(info.get("revenueGrowth")),
            fcf=safe(info.get("freeCashflow")),
            total_debt=safe(info.get("totalDebt")),
            book_value=safe(info.get("bookValue")),
            currency=info.get("currency", "IDR"),
            exchange=info.get("exchange"),
        )
        return f

    def get_news(self, symbol: str, limit=20) -> list[dict]:
        sym = self._candidates(symbol)[0]
        items = (yf.Ticker(sym).news or [])[:limit]
        out = []
        for it in items:
            c = it.get("content", it)  # versi baru yfinance bungkus di 'content'
            out.append({
                "title": c.get("title"),
                "publisher": (c.get("provider") or {}).get("displayName") if isinstance(c.get("provider"), dict) else c.get("publisher"),
                "url": (c.get("canonicalUrl") or {}).get("url") if isinstance(c.get("canonicalUrl"), dict) else c.get("link"),
                "published_date": c.get("pubDate") or c.get("providerPublishTime"),
            })
        return out


def batch_quotes(symbols: list[str]) -> pd.DataFrame:
    """Padanan MarketDataService batching: SATU panggilan untuk seluruh watchlist
    daripada N panggilan per-ticker."""
    if not symbols:
        return pd.DataFrame()
    data = yf.download(symbols, period="5d", interval="1d",
                       group_by="ticker", threads=True, progress=False)
    rows = []
    for s in symbols:
        try:
            sub = data[s] if len(symbols) > 1 else data
            sub = sub.dropna(how="all")
            if len(sub) < 1:
                continue
            price = float(sub["Close"].iloc[-1])
            prev = float(sub["Close"].iloc[-2]) if len(sub) >= 2 else price
            rows.append(dict(symbol=s, price=price, prev_close=prev,
                             change=price - prev,
                             change_pct=(price - prev) / prev * 100 if prev else None,
                             volume=int(sub["Volume"].iloc[-1])))
        except Exception:
            continue
    return pd.DataFrame(rows)
```

### 3.5 Registry (tambah sumber = data, bukan kode UI)

Pola Fincept: **ENDPOINTS dict** (akshare) + **`get_all_endpoints()` introspection** + **routing by-symbol**.

```python
# providers/registry.py
from .base import Provider, ProviderResult
from .yfinance_provider import YFinanceProvider

_PROVIDERS: dict[str, Provider] = {}

def register(p: Provider) -> None:
    _PROVIDERS[p.name] = p

def get(name: str) -> Provider:
    return _PROVIDERS[name]

def list_providers() -> list[str]:
    return list(_PROVIDERS)

def for_symbol(symbol: str) -> Provider:
    """Pilih provider berprioritas tertinggi yang supports() simbol."""
    cands = sorted((p for p in _PROVIDERS.values() if p.supports(symbol)),
                   key=lambda p: p.priority)
    if not cands:
        raise LookupError(f"Tidak ada provider untuk {symbol}")
    return cands[0]

def call(symbol: str, method: str, *args, **kwargs) -> ProviderResult:
    """Bungkus pemanggilan jadi envelope seragam (mirror fred error_code).
    Bisa dipakai fallback-chain: coba provider 1, gagal → provider berikutnya."""
    last = None
    for p in sorted((p for p in _PROVIDERS.values() if p.supports(symbol)),
                    key=lambda p: p.priority):
        try:
            data = getattr(p, method)(symbol, *args, **kwargs)
            if data is None or (hasattr(data, "empty") and data.empty):
                last = ProviderResult.fail("NO_DATA", "kosong", p.name); continue
            return ProviderResult.success(data, source=p.name)
        except NotImplementedError:
            last = ProviderResult.fail("NO_DATA", f"{p.name} tak dukung {method}", p.name)
        except Exception as e:
            last = ProviderResult.fail("NETWORK", str(e), p.name)
    return last or ProviderResult.fail("BAD_SYMBOL", "tak ada provider", "")

# --- registrasi awal ---
register(YFinanceProvider())
# Nanti: register(SectorsProvider(api_key=...))  # fundamentals lebih akurat
#        register(GoApiProvider(api_key=...))     # realtime intraday
#        register(CryptoProvider())               # asset_class='crypto'
```

**Cara menambah sumber baru** (mis. Sectors.app untuk fundamentals IHSG): tulis `class SectorsProvider(Provider)` dengan `supports()=endswith('.JK')`, `priority=50` (lebih kecil → diutamakan untuk fundamentals), implement `get_fundamentals()`. Lalu `register(SectorsProvider(...))`. **UI tidak berubah sama sekali.**

### 3.6 Caching dengan `st.cache_data` (TTL berlapis)

Pola Fincept: **TTL per tipe data** (quote 30s, info 300s, historical 120s, news 180s) + **disk-persisted static cache** + **`st.cache_resource` untuk singleton**.

```python
# services/market_service.py
import streamlit as st
import pandas as pd
from providers import registry

# --- Singleton yang TIDAK boleh dibuat ulang tiap rerun (ganti C++ singleton service) ---
@st.cache_resource
def get_db():
    import sqlite3
    conn = sqlite3.connect("data/app.db", check_same_thread=False)
    # ... buat tabel bila belum ada (lihat Bagian 6)
    return conn

# --- VOLATILE: harga (TTL pendek, mirror quote 30s) ---
@st.cache_data(ttl=30, show_spinner=False)
def cached_quote(symbol: str, _bust: int = 0) -> dict:
    res = registry.call(symbol, "get_quote")
    return res.data if res.ok else {"symbol": symbol, "price": None}

# --- HISTORY: cache key = argumen fungsi = (symbol, period, interval) ---
#     Ini padanan persis 'equity:candles:<sym>:<period>' di Fincept.
@st.cache_data(ttl=120, show_spinner="Mengambil grafik...")
def cached_history(symbol: str, period="6mo", interval="1d") -> pd.DataFrame:
    res = registry.call(symbol, "get_history", period=period, interval=interval)
    df = res.data if res.ok else pd.DataFrame()
    # Persist ke parquet agar cold-start / mode offline tetap jalan (peran CacheManager)
    if not df.empty:
        df.to_parquet(f"data/cache/{symbol}_{period}_{interval}.parquet")
    return df

# --- FUNDAMENTAL: slow-moving (mirror info 300s) ---
@st.cache_data(ttl=3600, show_spinner=False)
def cached_fundamentals(symbol: str) -> dict:
    res = registry.call(symbol, "get_fundamentals")
    return res.data if res.ok else {}

# --- STATIC metadata (nama/currency): resolve sekali, simpan di SQLite selamanya ---
def resolve_meta(symbol: str) -> dict:
    db = get_db()
    row = db.execute("SELECT name,currency,exchange,sector FROM instrument_meta "
                     "WHERE symbol=?", (symbol,)).fetchone()
    if row:
        return dict(name=row[0], currency=row[1], exchange=row[2], sector=row[3])
    f = cached_fundamentals(symbol)
    meta = dict(name=f.get("name"), currency=f.get("currency", "IDR"),
                exchange=f.get("exchange"), sector=f.get("sector"))
    db.execute("INSERT OR REPLACE INTO instrument_meta VALUES (?,?,?,?,?,datetime('now'))",
               (symbol, meta["name"], meta["currency"], meta["exchange"], meta["sector"]))
    db.commit()
    return meta

# --- BATCH watchlist dalam satu panggilan (mirror window batching 100ms) ---
@st.cache_data(ttl=30, show_spinner=False)
def cached_watchlist_quotes(symbols: tuple[str, ...], _bust: int = 0) -> pd.DataFrame:
    from providers.yfinance_provider import batch_quotes
    return batch_quotes(list(symbols))
```

> **Gotcha penting**: `st.cache_data` hilang saat app restart (seperti DataHub in-memory cache, BUKAN seperti CacheManager SQLite). Untuk data yang harus bertahan (watchlist, transaksi, warm quotes), gunakan lapisan SQLite/Parquet eksplisit. Untuk refresh manual: tombol yang memanggil `st.cache_data.clear()` atau menaikkan argumen `_bust`.

---

## 4. Desain per Fitur

### Fitur 1 — Harga & Grafik / Watchlist

**Cara Fincept**: `MarketDataService` batch quote (window 100ms, dedup, 1 panggilan), 30s TTL, candlestick + period buttons (1M/3M/6M/1Y/5Y), `EquityOverviewTab` (st.metric row + chart + panel fundamental).

**Desain Streamlit Anda**:

*Data model* (`models/quote.py`):
```python
from dataclasses import dataclass
@dataclass
class Quote:
    symbol: str; name: str | None; price: float | None
    change: float | None; change_pct: float | None; volume: int | None
    currency: str | None; ts: object | None
```

*UI components*:
- **Watchlist tersimpan** di SQLite (`watchlist` table) + `st.session_state['watchlist']`. Tambah/hapus via `st.text_input` + `st.button`, atau `st.data_editor`.
- **Tabel watchlist**: `cached_watchlist_quotes(tuple(watchlist))` → `st.dataframe` dengan `column_config` & pewarnaan kondisional (hijau/merah change_pct via `.style.map`).
- **Candlestick**: `plotly.graph_objects.go.Candlestick` dari `cached_history`. Period selector `st.radio(["1M","3M","6M","1Y","5Y"], horizontal=True)` dipetakan ke `period` yfinance (`1mo/3mo/6mo/1y/5y`).
- **st.metric row**: Harga (format `Rp`), Perubahan % (delta), Volume, Mkt Cap (formatter kompak: Rb/Jt/M/T).
- **Auto-refresh** saat jam bursa: `st.fragment(run_every=60)` membungkus tabel quote, ATAU komponen `streamlit-autorefresh`. Gate ke jam IDX (09:00–16:00 WIB) agar tak hammer Yahoo.

*Formatter Rupiah IDX (penting — market cap bank besar ratusan triliun)*:
```python
def fmt_idr(v, prefix="Rp "):
    if v is None: return "-"
    a = abs(v)
    if a >= 1e12: return f"{prefix}{v/1e12:.2f} T"
    if a >= 1e9:  return f"{prefix}{v/1e9:.2f} M"
    if a >= 1e6:  return f"{prefix}{v/1e6:.2f} Jt"
    if a >= 1e3:  return f"{prefix}{v/1e3:.0f} Rb"
    return f"{prefix}{v:,.0f}"
```

*Libs*: `yfinance`, `plotly`, `pandas`, `streamlit`.

---

### Fitur 2 — Portofolio & P/L

**Cara Fincept**: Ledger transaksi (append-only) + posisi materialized (WAC). **Hanya unrealized P/L** (tidak track realized — ini gap). **Fees diabaikan total**. Posisi bukan lot-by-lot (semua buy collapse ke 1 WAC). Snapshot NAV harian → time series untuk Sharpe/drawdown/beta.

**Desain Streamlit Anda (perbaiki gap Fincept)**: track **realized P/L + fees + lots IDX + dividends**.

*Data model* — dua DataFrame backed SQLite:

**`transactions` (source of truth, satu-satunya yang diedit user via `st.data_editor`)**:
| kolom | tipe | catatan |
|---|---|---|
| date | datetime | tanggal transaksi |
| symbol | str | `BBCA.JK` (UPPER, konsisten) |
| type | str | BUY / SELL / DIVIDEND |
| lots | int | input user (IDX) |
| shares | int | = lots × 100 |
| price | float | IDR/share |
| fee | float | IDR (lihat formula) |
| notes | str | |

**`positions` (derived, hasil replay transactions)**: symbol, qty_shares, avg_cost (WAC), cost_basis, realized_pnl, sector.

*Replay (single pass, dengan realized P/L + fees)*:
```python
def build_positions(tx: pd.DataFrame) -> pd.DataFrame:
    pos = {}
    for r in tx.sort_values("date").itertuples():
        p = pos.setdefault(r.symbol, dict(qty=0.0, cost=0.0, realized=0.0))
        gross = r.shares * r.price
        if r.type == "BUY":
            p["qty"]  += r.shares
            p["cost"] += gross + r.fee          # fee BELI dikapitalisasi ke cost basis
        elif r.type == "SELL":
            # GUARD denominator (mirror floor 1e-9 Fincept) agar tak NaN-poisoning
            avg = p["cost"] / p["qty"] if p["qty"] > 1e-9 else 0.0
            p["realized"] += (r.price * r.shares) - r.fee - avg * r.shares
            p["cost"] -= avg * r.shares          # kurangi cost proporsional; avg tetap
            p["qty"]  -= r.shares
        elif r.type == "DIVIDEND":
            p["realized"] += gross - r.fee       # gross = dividen total (net of pajak bila disimpan net)
    rows = [dict(symbol=s, qty_shares=v["qty"],
                 avg_cost=(v["cost"]/v["qty"] if v["qty"]>1e-9 else 0),
                 cost_basis=v["cost"], realized_pnl=v["realized"])
            for s, v in pos.items() if v["qty"] > 1e-9 or v["realized"] != 0]
    return pd.DataFrame(rows)
```

*Formula P/L (IDX, lot=100, IDR)*:

```
shares          = lots × 100
gross_value     = shares × price
cost_basis      = Σ(BUY shares × price) + Σ(BUY fee)     # fee beli dikapitalisasi
avg_cost (WAC)  = cost_basis_aktif / qty_shares_aktif

# Per holding (live):
market_value    = qty_shares × current_price
unrealized_pnl  = market_value − cost_basis
unrealized_pct  = unrealized_pnl / cost_basis × 100
weight          = market_value / total_market_value × 100
day_change      = (current_price − prev_close) × qty_shares

# Realized (saat SELL) — yang Fincept TIDAK lacak:
realized_pnl    = (sell_price × shares) − sell_fee − (avg_cost × shares)

# Total return:
total_return_pct = (market_value + realized_pnl + dividends − total_invested)
                   / total_invested × 100
```

*Biaya/fee IDX (default configurable)*:
```
fee_beli  ≈ 0.10% – 0.19% × gross_value
fee_jual  ≈ 0.20% – 0.29% × gross_value
           (termasuk PPh final 0.1% + levy ~0.04%)
dividen   : WHT 10% untuk residen → simpan net, atau simpan gross + kolom pajak
```
Sediakan setting `fee_buy_pct` / `fee_sell_pct` di Settings; auto-isi kolom `fee` saat input transaksi.

*Metrik risiko dari NAV series harian* (benchmark `^JKSE`, rf IDR ~6-7%):
```python
import numpy as np
r = nav.pct_change().dropna()
volatility   = r.std() * np.sqrt(252)
rf = 0.065                                   # SUN 10Y / BI rate, BUKAN US DGS10!
sharpe       = (r.mean() - rf/252) / r.std() * np.sqrt(252)
downside     = r[r < 0].std()
sortino      = (r.mean() - rf/252) / downside * np.sqrt(252)
dd           = nav / nav.cummax() - 1
max_drawdown = dd.min()
# beta/alpha vs ^JKSE
br = jkse_nav.pct_change().dropna().reindex(r.index).dropna()
beta, alpha = np.polyfit(br, r.reindex(br.index), 1)
var95  = -np.percentile(r, 5) * total_mv
cvar95 = -r[r <= np.percentile(r, 5)].mean() * total_mv
conc_top3 = weights.nlargest(3).sum()
```

*NAV snapshot*: tabel `snapshots(portfolio_id, date PRIMARY, total_value, cost_basis, pnl)` dengan `INSERT OR REPLACE` per hari. Bila <3 snapshot → backfill-by-replay (jalankan ledger hari-per-hari terhadap OHLC historis `^JKSE`/holdings) ATAU degrade ke estimasi cross-sectional + tampilkan "—".

*UI components*:
- `st.data_editor` untuk transactions (tambah/edit/hapus baris).
- KPI ribbon: `st.metric` × (Portfolio Value, Unrealized P&L, Realized P&L, Today) + chip risiko (Sharpe, Beta, MDD, Vol, Conc).
- Tabel holdings dengan `.style.background_gradient` di unrealized_pct.
- NAV line chart (plotly) + overlay `^JKSE` mode base-100 indexed.
- Heatmap (plotly treemap) berwarna P/L%.
- Sector allocation (plotly pie/sunburst) + correlation matrix (`returns.corr()` heatmap).

*Display lot IDX*: tampilkan "X lots (Y shares)"; simpan shares internal; `avg_cost` tetap per-share.

*Libs*: `pandas`, `numpy`, `plotly`, `sqlite3`, opsional `statsmodels` (OLS beta).

---

### Fitur 3 — Alert & Notifikasi

**Cara Fincept**: Dua subsistem — (1) **delivery** (toast in-app + OS notif + fan-out ~15 channel), (2) **ScanMonitor engine** (rule persisten di SQLite `scan_watches`, poll timer, evaluasi kondisi, **edge-trigger + cooldown gating**, fire → notif + history `scan_watch_events`).

**MASALAH UTAMA Streamlit**: **tidak ada background loop**. Skrip hanya jalan saat tab browser terbuka, rerun top-to-bottom. Solusi: **pisahkan "configure alerts" (Streamlit) dari "check alerts" (proses terpisah)**.

**Dua opsi (rekomendasi: B untuk alert sungguhan):**

**Opsi A — Poll-while-open** (paling simpel, cukup bila dashboard dibiarkan terbuka saat jam bursa):
```python
@st.fragment(run_every=60)            # rerun fragmen tiap 60 detik
def alert_tick():
    rules = load_rules()              # dari SQLite
    for rule in rules:
        for sym in rule["symbols"]:
            hist = cached_history(sym, period="5d", interval="1d")
            fired, detail = evaluate(rule, hist)
            # state gating WAJIB di session_state (bukan global — direset tiap rerun!)
            key = f"{rule['id']}:{sym}"
            stt = st.session_state.setdefault("alert_state", {}).setdefault(
                  key, {"armed": True, "last_fired": 0})
            now = time.time()
            if fired and stt["armed"] and (now - stt["last_fired"] >= rule["cooldown"]*60):
                st.toast(f"🔔 {sym} — {detail}")
                record_event(rule["id"], sym, detail)
                stt["armed"] = False; stt["last_fired"] = now
            elif not fired:
                stt["armed"] = True              # re-arm saat kondisi kembali false
```
Keterbatasan: mati saat tab ditutup; tak ada push HP.

**Opsi B — Scheduler daemon terpisah** (`alerts_daemon.py`, jalan independen via Windows Task Scheduler / `pythonw`):
```python
# alerts_daemon.py  (BUKAN Streamlit — proses mandiri)
from apscheduler.schedulers.blocking import BlockingScheduler
import sqlite3, time, requests, operator
import yfinance as yf

DB = "data/app.db"
OPS = {">": operator.gt, "<": operator.lt, ">=": operator.ge, "<=": operator.le,
       "crosses_above": lambda prev, cur, t: prev <= t and cur > t,
       "crosses_below": lambda prev, cur, t: prev >= t and cur < t}

def is_market_hours():
    import datetime, zoneinfo
    now = datetime.datetime.now(zoneinfo.ZoneInfo("Asia/Jakarta"))
    return now.weekday() < 5 and 9 <= now.hour < 16   # IDX ~09:00–16:00 WIB

def check_all():
    if not is_market_hours():
        return
    db = sqlite3.connect(DB)
    rules = db.execute("SELECT id,symbols,indicator,op,value,cooldown_min FROM rules "
                       "WHERE active=1").fetchall()
    for rid, syms, ind, op, val, cooldown in rules:
        for sym in syms.split(","):
            hist = yf.Ticker(sym).history(period="5d", interval="1d")
            if len(hist) < 2:
                continue
            cur, prev = float(hist["Close"].iloc[-1]), float(hist["Close"].iloc[-2])
            # operator yang butuh prev (crossing/==) baca 1 bar mundur
            triggered = (OPS[op](prev, cur, val) if "crosses" in op
                         else OPS[op](cur, val))
            fire_with_gating(db, rid, sym, triggered, cooldown,
                             detail=f"{ind} {op} {val:,.0f}")
    db.commit()

def fire_with_gating(db, rid, sym, triggered, cooldown_min, detail):
    # state gating di SQLite (daemon tak punya session_state)
    row = db.execute("SELECT armed,last_fired FROM rule_state WHERE rule_id=? AND symbol=?",
                     (rid, sym)).fetchone()
    armed, last_fired = (row if row else (1, 0))
    now = time.time()
    if triggered and armed and (now - last_fired >= cooldown_min*60):
        ok = send_telegram(f"🔔 {sym} — {detail}")
        db.execute("INSERT INTO alert_events(rule_id,symbol,detail,fired_at,delivered) "
                   "VALUES (?,?,?,?,?)", (rid, sym, detail, now, int(ok)))  # surfacing kegagalan!
        armed, last_fired = 0, now
    elif not triggered:
        armed = 1                                   # re-arm
    db.execute("INSERT OR REPLACE INTO rule_state VALUES (?,?,?,?)",
               (rid, sym, armed, last_fired))

def send_telegram(text) -> bool:
    import os
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{os.environ['TG_TOKEN']}/sendMessage",
            json={"chat_id": os.environ["TG_CHAT_ID"], "text": text}, timeout=10)
        return r.ok
    except Exception:
        return False

if __name__ == "__main__":
    sched = BlockingScheduler()
    sched.add_job(check_all, "interval", seconds=60)
    sched.start()
```
Streamlit lalu menjadi **CONFIG + HISTORY VIEWER** atas SQLite yang sama.

*Channel push personal*: Telegram (`requests.post` ke Bot API — termurah & andal untuk HP), desktop (`plyer.notification.notify` cross-platform / `windows-toasts`), email (`smtplib` + Gmail app password).

*Data model rule* (sederhanakan dari `scan_watches`):
```
rules(id, name, symbols, indicator, op, value, value2, logic,
      cooldown_min DEFAULT 15, active, created_at)
rule_state(rule_id, symbol, armed, last_fired)         -- gating persisten
alert_events(id, rule_id, symbol, detail, fired_at, delivered)  -- history
```
Kondisi kompleks (AND/OR, between, indikator-vs-indikator) → simpan `conditions_json` agar skema tumbuh tanpa migrasi (pola Fincept).

*Pola WAJIB ditiru — edge-trigger + cooldown*: simpan `{armed, last_fired}` per `(rule, symbol)`. Fire **hanya saat false→true transition AND cooldown lewat**. Set `armed=False` setelah fire, re-arm saat kondisi false lagi. **Tanpa ini, alert "price > X" fire setiap tick.** State di `session_state` (mode A) atau SQLite `rule_state` (mode B).

*Jangan tiru one-shot*: poll-mode Fincept menghapus watch setelah fire. Untuk monitor pribadi Anda mau **recurring** (semantik realtime-mode) atau tambah flag `one_shot`.

*UI Streamlit (AlertsPanel)*: form buat rule (`st.selectbox` simbol, `st.selectbox` indikator CLOSE/RSI/SMA, `st.selectbox` operator, `st.number_input` threshold, `st.number_input` cooldown), daftar rule aktif (`st.data_editor`), log alert (`alert_events` → `st.dataframe`), toggle channel. **Surface delivery error** (kolom `delivered`) — kegagalan Telegram di Fincept silent.

*Indikator (pandas/`ta`)*: CLOSE/OPEN/HIGH/LOW/VOLUME + SMA/EMA/RSI. Rule starter IHSG: `^JKSE close crosses_below 7000`, `BBCA.JK close > prev_close × 1.03`, `TLKM.JK RSI(14) < 30`.

*Libs*: `APScheduler`, `requests`, `plyer`, `ta`/`pandas_ta`, `yfinance`, `sqlite3`.

---

### Fitur 4 — Fundamental & Berita

**Cara Fincept**: `EquityFinancialsTab` (3-way Income/Balance/Cashflow, statement raw period→{line_item:value}, DuPont/likuiditas), `EquityAnalysisTab` (6 verdict card heuristik dari StockInfo), `EquityNewsTab` (provider chain GNews→Yahoo), `EquitySentimentTab` (VADER/lexicon over headlines + price momentum). Berita = ~60 RSS feed paralel + dedup + sentimen 2-tahap.

**Desain Streamlit Anda**:

**4a. Fundamental & Laporan Keuangan**

*Data model*: dict `Fundamentals` (schema 3.3) + DataFrame statement (yfinance `.financials`/`.balance_sheet`/`.cashflow`, transposed).

*Pola wajib (gotcha Fincept)*: **statement punya line-item heterogen** — jangan hardcode satu key, coba list kandidat:
```python
def get_val(df, *names):
    for n in names:
        if n in df.index: return df.loc[n]
    return None
revenue = get_val(fin, "Total Revenue", "TotalRevenue", "Revenue")
net_inc = get_val(fin, "Net Income", "NetIncome", "Net Income Common Stockholders")
```

*UI*: `st.radio(["Laba Rugi","Neraca","Arus Kas"])` → `st.dataframe` transposed (label Rupiah), rasio terhitung (margin, DuPont ROE, current ratio), bar trend revenue/net income antar periode (plotly), `st.download_button` CSV.

*Tab Analisis — verdict heuristik* (pure Python, tanpa fetch tambahan; pakai `cached_fundamentals`):
```python
def verdicts(f):
    v = []
    pe = f.get("pe")
    if pe is not None:
        v.append(("Valuasi", "Murah" if pe < 15 else "Mahal" if pe > 25 else "Wajar",
                  "success" if pe < 15 else "error" if pe > 25 else "warning"))
    roe = f.get("roe")
    if roe is not None:
        v.append(("Profitabilitas", "Kuat" if roe > 0.15 else "Lemah",
                  "success" if roe > 0.15 else "warning"))
    # ... DER, FCF>0, revenue_growth>0
    return v
```
Render `st.success/st.warning/st.error` + gauge `plotly go.Indicator` (targetMeanPrice vs currentPrice).

> **PERINGATAN IHSG (gotcha)**: threshold absolut Fincept **tidak sector-adjusted**. PBV/ROE "normal" bank ≠ telco. Untuk IHSG, gunakan **band per-sektor** (bank: PBV 1-3 wajar; telco beda). Dan **degrade graceful**: cakupan analis IDX tipis → `targetMeanPrice`/`recommendationKey` sering null untuk mid/small cap → tampilkan "Tidak ada cakupan analis".

**4b. Berita & Sentimen**

*Sumber berita IHSG* (Fincept punya NOL feed Indonesia — bangun baru): RSS Kontan, Bisnis.com, CNBC Indonesia, Detik Finance, Kompas Ekonomi, Antara Ekonomi. **Fallback praktis**: Google News RSS berbahasa Indonesia:
```python
url = "https://news.google.com/rss/search?q=IHSG+OR+BBCA+saham&hl=id&gl=ID&ceid=ID:id"
```

*Fetch pattern* (mirror NewsService — paralel, browser UA, shape-check, dedup):
```python
import feedparser, requests
from concurrent.futures import ThreadPoolExecutor

FEEDS = [{"id":"kontan","url":"https://.../rss","tier":2}, ...]  # VERIFIKASI tiap URL live!
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}  # banyak situs ID 403 tanpa ini

@st.cache_data(ttl=600)                       # cadence 10 menit (mirror Fincept)
def fetch_news() -> pd.DataFrame:
    def one(feed):
        try:
            body = requests.get(feed["url"], headers=UA, timeout=4).content
            # shape-check: RSS asli mulai <?xml/<rss/<feed (HTML = access-denied)
            if not body.lstrip()[:5].lower().startswith((b"<?xml", b"<rss", b"<feed")):
                return []
            parsed = feedparser.parse(body)
            rows = []
            for e in parsed.entries:
                ts = time.mktime(e.published_parsed) if e.get("published_parsed") else time.time()
                rows.append(dict(headline=e.title, link=e.link, source=feed["id"],
                                 tier=feed["tier"], published_ts=ts,
                                 summary=strip_html(e.get("summary",""))))
            return rows
        except Exception:
            return []
    with ThreadPoolExecutor(max_workers=8) as ex:
        all_rows = [r for batch in ex.map(one, FEEDS) for r in batch]
    df = pd.DataFrame(all_rows)
    # stable id = hash(normalized title + link); dedup Jaccard window 24h opsional
    df = df.drop_duplicates(subset=["link"]).sort_values("published_ts", ascending=False)
    return df
```

*Sentimen Bahasa Indonesia (gotcha: VADER English TIDAK jalan untuk Bahasa)*. Rekomendasi: **lexicon finance Indonesia** (cepat, lokal):
```python
POS = {"melonjak","menguat","naik","untung","rekor","melesat","rebound","cuan"}
NEG = {"anjlok","melemah","turun","rugi","koreksi","terkoreksi","ambruk","jatuh","merosot"}
def score_id(headline: str) -> tuple[str, float]:
    w = headline.lower().split()
    net = sum(t in POS for t in w) - sum(t in NEG for t in w)
    if net >= 1:  return "BULLISH", min(net/3, 1)
    if net <= -1: return "BEARISH", max(net/3, -1)
    return "NEUTRAL", 0.0
```
Threshold label: score ≥ 0.15 BULLISH, ≤ −0.15 BEARISH (mirror Fincept). Upgrade akurasi: IndoBERT sentiment (HuggingFace) di-load sekali via `@st.cache_resource` untuk detail view.

*Ticker extraction*: **jangan** pakai regex "2-5 huruf kapital" Fincept (over-capture). Match terhadap watchlist IDX dikenal atau `\b[A-Z]{4}\b` (ticker IDX 4 huruf).

*UI*: filter kategori/ticker (`st.session_state`), kartu berita (`st.container` berwarna sentimen + link + publisher + tanggal), rollup sentimen (plotly gauge/bar bullish/bearish/neutral, `st.metric` overall). Persist ke SQLite untuk chart sentimen-over-time.

*Libs*: `feedparser`, `requests`, `beautifulsoup4`, opsional `transformers`+`torch` (IndoBERT) atau `vaderSentiment` (bila translate dulu).

---

## 5. Sumber Data IHSG — Perbandingan & Stack Awal

| Sumber | Tipe | Cakupan | Realtime/Delay | Biaya | Cara Pakai |
|---|---|---|---|---|---|
| **yfinance (.JK / ^JKSE)** | Library Python gratis | Harga delayed + full history OHLC + fundamental parsial + news; `^JKSE`=indeks | Delay ~15-20 mnt | **Gratis, tanpa key** | `yf.Ticker("BBCA.JK")`, `yf.Ticker("^JKSE")` |
| **Sectors.app** | REST API (free Insider tier) | ~99% fundamental IDX + laporan keuangan + harga harian | Harian/EOD | Free key; paid lebih tinggi | REST, key di header; `docs.sectors.app` |
| **GoAPI.io** | REST API (free terbatas) | Last price snapshot + history + indeks | Realtime (tier) | Free quota; paid | REST, daftar di `goapi.io` |
| **IDX official** | Official | Otoritatif realtime/EOD/historis; JSON daftar ticker | Realtime (lisensi); situs delayed | Enterprise-paid; scraping gratis non-komersial | `data.idx.co.id`; scraper komunitas |
| **TradingView** | Widget (no data API) | Chart IDX (`IDX:BBCA`) | Delayed widget | Free widget | Embed widget |
| **Alpha Vantage** | API free/paid | Global; IDX/.JK sangat tipis | Delayed | Free 25/hari | `BBCA.JKT` (tak andal) — **skip untuk IDX** |
| **Twelve Data** | API free/paid | IDX sbg `XIDX`; harga+history+WS | WS paid; gated | Free 800/hari; IDX realtime paid | `BBCA:XIDX` — multi-asset nanti |
| **Stockbit/RTI** | Scrape (no API) | Quote+fundamental retail | Rapuh/ToS | Scraper gratis | **HINDARI** |
| **OHLC.dev / Invezgo** | Paid API | Realtime IDX komersial REST | Realtime | Paid | Fallback realtime niche |

### Stack awal yang direkomendasikan
**MULAI GRATIS:**
1. **yfinance** → harga + history + indeks (`.JK` + `^JKSE`) = **PRIMARY**.
2. **Sectors.app (free Insider key)** → fundamental + laporan keuangan (upgrade akurasi vs yfinance yang tipis untuk IDX) = provider kedua di balik interface yang sama.
3. **TradingView widget** (`IDX:TICKER`) → chart embed opsional.
4. **Scraper komunitas sekali jalan** (mis. `nichsedge/idx-bei`) → master daftar ticker IDX (one-time, simpan ke SQLite).

**UPGRADE realtime intraday**: GoAPI.io (free terbatas → paid).
**HINDARI**: Stockbit/RTI scraping, Alpha Vantage (IDX buruk), IDX enterprise Data Services.

> Karena semua sumber gratis **delayed**, cache agresif dengan `st.cache_data` (TTL beberapa menit) tidak mengurangi kualitas data sama sekali.

---

## 6. Struktur Proyek yang Diusulkan

```
saham-monitor/
├── app.py                          # entry: layout, sidebar global, init session_state
├── requirements.txt
├── .streamlit/
│   └── secrets.toml                # API keys (Sectors, GoAPI, Telegram) — JANGAN commit
├── config.py                       # tickers default, TTL, jam bursa, fee default
│
├── pages/                          # multipage auto-routing (= DockScreenRouter)
│   ├── 1_📈_Dashboard.py           # watchlist + quote + chart (Fitur 1)
│   ├── 2_🔍_Riset_Saham.py         # tabs Ringkasan/Keuangan/Analisis/Teknikal/... (Fitur 4)
│   ├── 3_💼_Portofolio.py          # ledger + P/L + metrik (Fitur 2)
│   ├── 4_🔔_Alert.py               # config rule + history (Fitur 3)
│   ├── 5_📰_Berita.py              # feed + sentimen (Fitur 4)
│   └── 6_⚙️_Pengaturan.py          # fee %, rf rate, API keys, watchlist
│
├── providers/                      # SATU-SATUNYA lapisan yang bicara ke sumber data
│   ├── __init__.py
│   ├── base.py                     # Provider ABC + ProviderResult
│   ├── schema.py                   # normalized schema + normalize_history/safe
│   ├── registry.py                 # register/for_symbol/call (fallback chain)
│   ├── yfinance_provider.py
│   ├── sectors_provider.py         # (nanti) fundamental IDX akurat
│   └── goapi_provider.py           # (nanti) realtime
│
├── services/                       # orkestrasi + caching + fallback (= C++ services)
│   ├── market_service.py           # cached_quote/history/fundamentals/watchlist
│   ├── portfolio_service.py        # build_positions, P/L, metrik, snapshot NAV
│   ├── alert_service.py            # CRUD rule, evaluate(), gating helper
│   └── news_service.py             # fetch_news, dedup, score_id sentimen
│
├── models/                         # dataclasses (decouple UI dari field provider)
│   ├── quote.py                    # Quote
│   ├── fundamentals.py             # Fundamentals
│   └── transaction.py             # Transaction, Position
│
├── storage.py                      # SQLite: skema + koneksi (st.cache_resource)
├── state.py                        # helper st.session_state
├── utils.py                        # fmt_idr, fmt_lot, is_market_hours, strip_html
│
├── alerts_daemon.py                # PROSES TERPISAH (APScheduler) — bukan Streamlit
│
└── data/
    ├── app.db                      # SQLite durable (watchlist, transactions, rules, meta)
    └── cache/                      # parquet history per (symbol,period,interval)
```

*Skema SQLite (`storage.py`)*:
```sql
CREATE TABLE IF NOT EXISTS instrument_meta(
    symbol TEXT PRIMARY KEY, name TEXT, currency TEXT, exchange TEXT,
    sector TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS watchlist(symbol TEXT PRIMARY KEY, added_at TEXT);
CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY, date TEXT, symbol TEXT, type TEXT,
    lots INTEGER, shares INTEGER, price REAL, fee REAL, notes TEXT);
CREATE TABLE IF NOT EXISTS snapshots(
    portfolio_id TEXT, date TEXT, total_value REAL, cost_basis REAL,
    pnl REAL, PRIMARY KEY(portfolio_id, date));
CREATE TABLE IF NOT EXISTS rules(
    id TEXT PRIMARY KEY, name TEXT, symbols TEXT, indicator TEXT, op TEXT,
    value REAL, value2 REAL, logic TEXT, cooldown_min INTEGER DEFAULT 15,
    active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS rule_state(
    rule_id TEXT, symbol TEXT, armed INTEGER, last_fired REAL,
    PRIMARY KEY(rule_id, symbol));
CREATE TABLE IF NOT EXISTS alert_events(
    id INTEGER PRIMARY KEY, rule_id TEXT, symbol TEXT, detail TEXT,
    fired_at REAL, delivered INTEGER);
```

---

## 7. Tech Stack & Dependencies

```txt
# requirements.txt
# --- Core UI & data ---
streamlit>=1.40
pandas>=2.2
numpy>=1.26

# --- Sumber data ---
yfinance>=0.2.40            # harga/history/fundamental/news (.JK, ^JKSE)
requests>=2.32             # REST (Sectors/GoAPI) + Telegram + RSS fetch

# --- Visualisasi ---
plotly>=5.22               # candlestick, gauge, treemap, line chart

# --- Indikator teknikal ---
ta>=0.11                   # RSI/MACD/SMA/BB/Stoch (atau pandas_ta)

# --- Berita & sentimen ---
feedparser>=6.0            # RSS/Atom
beautifulsoup4>=4.12       # strip HTML summary
vaderSentiment>=3.3        # opsional (butuh translate utk Bahasa)
# transformers>=4.44       # opsional: IndoBERT sentiment (berat, butuh torch)
# torch>=2.2               # opsional, pasangan transformers

# --- Alert daemon ---
APScheduler>=3.10          # scheduler background (proses terpisah)
plyer>=2.1                 # desktop notification cross-platform
# windows-toasts          # opsional khusus Windows

# --- Metrik (opsional) ---
# statsmodels>=0.14        # OLS beta/alpha (numpy.polyfit cukup untuk awal)

# --- Penyimpanan ---
pyarrow>=16.0              # parquet cache history

# --- Util ---
tzdata                     # zoneinfo Asia/Jakarta di Windows
python-dateutil>=2.9
```

Secrets via `.streamlit/secrets.toml`:
```toml
SECTORS_API_KEY = "..."
GOAPI_KEY = "..."
TG_TOKEN = "..."
TG_CHAT_ID = "..."
RF_RATE = 0.065        # SUN 10Y / BI rate untuk Sharpe IDR
```

---

## 8. Roadmap MVP → Bertahap

### Sprint 0 — Fondasi arsitektur (sebelum fitur apa pun)
- Setup struktur folder + `requirements.txt` + `storage.py` (skema SQLite) + `config.py`.
- Implement **lapisan provider lengkap**: `base.py`, `schema.py`, `yfinance_provider.py`, `registry.py`.
- Implement `services/market_service.py` (`cached_quote/history/fundamentals` + `@st.cache_resource` DB).
- `utils.py`: `fmt_idr`, `is_market_hours`, `fmt_lot`.
- **Deliverable**: bisa panggil `registry.for_symbol("BBCA.JK").get_quote()` → dict ternormalisasi. Ini fondasi semua fitur.

### Sprint 1 — Fitur 1: Harga & Grafik / Watchlist (MVP minimal jalan)
- `pages/1_Dashboard.py`: watchlist persisten (SQLite), tabel quote (batch), candlestick + period selector, st.metric row.
- Settings page minimal (kelola watchlist).
- **Deliverable**: dashboard fungsional pertama — sudah berguna sendiri.

### Sprint 2 — Fitur 4a: Fundamental & Riset Saham
- `pages/2_Riset_Saham.py`: tabs Ringkasan/Laporan Keuangan/Analisis/Teknikal.
- `get_val` multi-candidate untuk statement, verdict heuristik (sector-aware band), gauge analis (degrade graceful), indikator `ta` + scoring.
- **Deliverable**: deep-analysis per saham.

### Sprint 3 — Fitur 2: Portofolio & P/L
- `models/transaction.py`, `services/portfolio_service.py` (`build_positions` + fees + realized + lots).
- `pages/3_Portofolio.py`: `st.data_editor` transaksi, KPI ribbon, holdings table, NAV chart + `^JKSE` overlay.
- Snapshot NAV harian + metrik risiko (Sharpe/Sortino/MDD/beta, rf IDR).
- **Deliverable**: tracking portofolio dengan P/L akurat (lebih baik dari Fincept).

### Sprint 4 — Fitur 3: Alert & Notifikasi
- `services/alert_service.py` (CRUD + `evaluate` + gating), `pages/4_Alert.py` (config + history).
- **Mulai Opsi A** (poll-while-open, `st.fragment`) untuk validasi cepat.
- Lalu **Opsi B** (`alerts_daemon.py` + Telegram + Windows Task Scheduler) untuk alert sungguhan.
- **Deliverable**: alert edge-trigger + cooldown + push HP.

### Sprint 5 — Fitur 4b: Berita & Sentimen
- `services/news_service.py` (RSS paralel + dedup + lexicon ID), `pages/5_Berita.py`.
- Verifikasi URL feed Indonesia hidup; sentimen lexicon dulu, IndoBERT belakangan.
- **Deliverable**: feed berita + rollup sentimen.

### Sprint 6+ — Extensibility & polish
- Tambah `SectorsProvider` (fundamental akurat) + `GoApiProvider` (realtime) — **tanpa ubah UI**.
- Provider crypto/global/macro (asset_class baru) untuk membuktikan extensibility.
- Backfill NAV by-replay, sector-aware verdict bands, sentimen-over-time chart, IndoBERT.

---

## 9. Tabel Pola Reusable: Pola Fincept → Implementasi Anda

| Pola Fincept | Implementasi Streamlit Anda |
|---|---|
| Layering UI/service/provider/source | `pages/` → `services/` → `providers/` → yfinance; UI tak pernah impor provider |
| Subprocess + JSON-over-stdout + `extract_json()` | **Dihapus** — panggil library in-process; dapat objek Python langsung |
| Daemon long-lived (hindari cold-start import) | `@st.cache_resource` untuk session/DB/model (dibuat sekali per proses) |
| `CacheManager` (SQLite K/V, TTL, category) | `@st.cache_data(ttl)` (volatile) + SQLite/Parquet (durable) |
| TTL berlapis (quote 30s, info 300s, hist 120s, news 180s) | `@st.cache_data(ttl=30/3600/120/600)` per tipe data |
| Cache-first read → async refresh | `@st.cache_data` (cache-hit instan) + tombol refresh / `_bust` arg |
| Colon-namespaced keys (`equity:quote:BBCA.JK`) | Argumen fungsi = cache key; prefix-invalidate via `st.cache_data.clear()` |
| Typed struct terpisah dari fetch | `@dataclass` di `models/`; provider kembalikan dict ternormalisasi |
| Error by convention (key `error`/`error_code`) | `ProviderResult{ok, error_code, message}`; UI cek `.ok` |
| Symbol resolution candidate (.NS/.BO...) | `_candidates()` **+ tambah `.JK`** (yang Fincept lupa) |
| Request batching (window 100ms + dedup) | `yf.download(list)` sekali untuk seluruh watchlist |
| Concurrency cap (QProcess pool=3) | `@st.cache_data` + opsional `ThreadPoolExecutor(max_workers=3)` |
| `DataHub` pub/sub + `TopicPolicy` | `@st.cache_data` per topic + `st.fragment(run_every=)` + gate jam bursa |
| `DockScreenRouter` (lazy + state save/restore) | `pages/` multipage + `st.session_state` |
| Ledger + materialized position (replay) | `transactions` table → `build_positions()` single-pass |
| WAC dengan guard denominator (floor 1e-9) | `avg = cost/qty if qty > 1e-9 else 0` |
| Daily NAV snapshot (INSERT OR REPLACE per hari) | tabel `snapshots(portfolio_id, date PRIMARY)` |
| **Edge-trigger + cooldown gating** (paling berharga) | `{armed, last_fired}` di `session_state` (mode A) / SQLite `rule_state` (mode B) |
| Rule table terpisah dari events table | `rules` + `alert_events` (history bertahan saat rule dihapus) |
| `conditions_json` (skema tumbuh tanpa migrasi) | kolom JSON untuk kondisi kompleks (AND/OR/between/crossing) |
| Channel abstraction + fan-out | fungsi `send_telegram/send_desktop/send_email` + per-trigger toggle |
| Feed catalog as data (tier-driven) | `FEEDS = [{id,url,tier}]`; tier = tiebreaker dedup |
| RSS defensive (browser UA + shape-check + multi-date) | header Mozilla + cek `<?xml/<rss/<feed` + fallback `now()` |
| Dedup Jaccard (window 24h) / TF-IDF | `drop_duplicates` + Jaccard token headline opsional |
| Sentimen 2-tahap (keyword cepat + VADER detail) | lexicon ID cepat untuk list + IndoBERT untuk detail |
| Verdict layer (heuristik dari data cached) | `verdicts(f)` pure Python, **sector-aware band untuk IDX** |
| Multi-candidate field lookup (`get_val`) | `get_val(df, "Total Revenue", "Revenue", ...)` |
| Secrets dari secure store (inject runtime) | `st.secrets` / env var; jangan hardcode |
| NaN/Inf → None sanitization (`safe_call`) | `df.replace([inf,-inf], nan)`; `safe()` per field |

---

## 10. Catatan Lisensi & Etika

### Lisensi Fincept (KRITIS)
- **Fincept Terminal berlisensi AGPL + lisensi komersial (dual-license).** AGPL adalah copyleft kuat: jika Anda menggunakan/memodifikasi kode AGPL dan menjalankannya sebagai layanan jaringan, Anda **wajib merilis seluruh source code turunan Anda di bawah AGPL juga**.
- **JANGAN menyalin, mem-port baris-demi-baris, atau menurunkan kode dari source Fincept** (file `.cpp/.h`, skrip Python `yfinance_data.py`, dll). Termasuk menerjemahkan C++ → Python secara mekanis.
- **Yang boleh**: mempelajari **ide arsitektural** (layering, cache-first, edge-trigger gating, normalized schema) dan **mengimplementasikan ulang dari nol** dengan kode Anda sendiri. Ide/arsitektur/pola umum **tidak** dilindungi hak cipta — ekspresi kode spesifik yang dilindungi.
- Dokumen ini sengaja menyajikan **sketsa kode baru** (bukan salinan Fincept) sebagai titik awal milik Anda. Tetap tulis ulang sesuai pemahaman Anda.

### Lisensi dependency Anda
- **yfinance**: Apache-2.0 (boleh dipakai). Tapi datanya berasal dari **Yahoo Finance** — penggunaan tunduk pada **ToS Yahoo**: untuk **personal, non-komersial, read-only**. Jangan redistribusi data, jangan komersialkan, jangan hammer (rate-limit risk → cache agresif).
- **Sectors.app / GoAPI.io**: patuhi ToS & batas kuota free tier; simpan key di `secrets.toml` (jangan commit ke git).
- **IDX official**: scraping hanya **non-komersial**; daftar ticker one-time wajar, jangan polling agresif. Data realtime resmi butuh lisensi enterprise.
- **Stockbit/RTI**: melanggar ToS bila di-scrape → **hindari**.
- **Google News / gnews**: redirect consent URL, rate-limited, region-gated; pakai wajar.

### Etika & keamanan
- **Read-only**: aplikasi ini **memantau**, bukan eksekusi order. Jangan tambahkan eksekusi trade/transfer dana otomatis.
- **Bukan nasihat keuangan**: verdict heuristik (PER<15 "murah") adalah sinyal kasar, **bukan rekomendasi**. Beri disclaimer di UI.
- **Akurasi**: data delayed ~15-20 menit; jangan andalkan untuk keputusan time-sensitive. Tampilkan timestamp & sumber.
- **Secrets**: `secrets.toml` di `.gitignore`. Jangan log API key. Jangan bocorkan env credential ke proses anak.
- **Single-user lokal**: jika kelak di-deploy sebagai layanan jaringan, AGPL (bila Anda terlanjur memakai kode AGPL) akan memicu kewajiban open-source — alasan tambahan untuk menulis kode Anda sendiri dari nol.

---

**Ringkasan eksekusi**: Mulai dari **Sprint 0 (lapisan provider + registry + cache)** karena itu fondasi yang membuat keempat fitur extensible. yfinance `.JK`/`^JKSE` adalah sumber gratis terbaik untuk memulai; Sectors.app/GoAPI masuk belakangan **tanpa menyentuh UI** berkat interface Provider. Pola paling berharga untuk ditiru: **cache-first dengan TTL berlapis** (data), **WAC + realized P/L dari ledger replay** (portofolio), dan **edge-trigger + cooldown gating** (alert). Tulis semua kode Anda sendiri — gunakan Fincept hanya sebagai peta arsitektur.