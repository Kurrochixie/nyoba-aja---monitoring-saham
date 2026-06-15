# SPEC REDESIGN UI — "Saham Monitor" → Trading Terminal Premium

> Dokumen ini adalah spesifikasi rombak total UI app Streamlit `saham-monitor` (Python 3.14, Streamlit 1.58, Plotly 6.8, `st.navigation` + `st.fragment` + `st.metric` + `st.dataframe`). Semua selector `data-testid` sudah diverifikasi pada bundle Streamlit 1.58.0 terpasang. Semua snippet copy-paste-able dan dipetakan ke file nyata: `app.py`, `ui/theme.py`, `ui/charts.py`, `pages/dashboard.py`, `.streamlit/config.toml`.

---

## 1. Arah Desain & Moodboard

**Konsep:** *"IDX Terminal"* — perpaduan ketenangan **TradingView** (base biru-gelap `#0E1117`, grid nyaris tak terlihat, accent biru-amber) dengan kepadatan data ala **Bloomberg** (angka monospace tabular, label uppercase kecil, hijau/merah semantik) dan kehalusan **fintech 2025-2026** (glass card, micro-interaction 160ms, ticker tape berjalan).

**Kesan yang dikejar:**
- **Gelap berlapis, bukan hitam pekat.** Kedalaman dibuat dari beda lightness surface (4-8%) + border 1px halus, bukan shadow tebal.
- **Angka = warga kelas satu.** Semua harga/volume/persen pakai `JetBrains Mono` + `tabular-nums`, rata kanan, titik desimal segaris.
- **Warna terukur.** Abu-abu mendominasi ~90% UI; hijau `#26A69A`/merah `#EF5350` HANYA untuk naik/turun; satu accent amber `#FF9F1C` (warna brand app sekarang) untuk aksi/fokus.
- **Padat tapi berirama.** Grid 8px, alignment ketat, hierarki tipografi jelas (label kecil uppercase + angka besar tebal).
- **Hidup tapi tenang.** Ticker tape berjalan + fade-in halus + hover lift. Tidak ada bounce/animasi mainan.

**Prinsip non-negosiabel (dari riset):**
1. Hijau = NAIK, Merah = TURUN (konvensi IDX/RTI/Stockbit, bukan konvensi bursa Tiongkok).
2. Selalu sertakan TANDA (`+`/`-`) dan ikon panah (`▲`/`▼`) selain warna (aksesibilitas color-blind).
3. Locale Indonesia: ribuan = TITIK, desimal = KOMA (`7.342,18`). Jangan andalkan `locale.setlocale` (sering gagal di Windows).

---

## 2. Design Tokens FINAL

### 2.1 Palet warna

| Token | Hex / Nilai | Pemakaian |
|---|---|---|
| `--bg-0` | `#07090f` | Body / lapisan paling dalam |
| `--bg-1` | `#0b0e14` | App background (= `backgroundColor` config sekarang) |
| `--bg-2` | `#11151d` | Panel |
| `--bg-3` | `#151a23` | Card / sidebar / input (= `secondaryBackgroundColor`) |
| `--bg-elev` | `#1a2030` | Card hover / elevated |
| `--stroke` | `#222b39` | Border halus default (= `borderColor` config) |
| `--stroke-strong` | `#2c3850` | Border hover / focus |
| `--text-hi` | `#e8edf5` | Nilai utama, judul |
| `--text` | `#c2cad6` | Teks isi |
| `--text-dim` | `#7a869a` | Label, caption, muted |
| `--accent` | `#ff9f1c` | Amber — aksi/fokus/brand (= `primaryColor`) |
| `--accent-2` | `#4d8dff` | Biru info |
| `--up` | `#26a69a` | Hijau naik (chart-friendly) |
| `--up-bright` | `#0ecb81` | Hijau high-contrast (badge/teks) |
| `--up-soft` | `rgba(38,166,154,.14)` | BG pill delta + |
| `--down` | `#ef5350` | Merah turun (chart-friendly) |
| `--down-bright` | `#f6465d` | Merah high-contrast (badge/teks) |
| `--down-soft` | `rgba(239,83,80,.14)` | BG pill delta - |
| `--flat` | `#7a869a` | Flat / perubahan 0 |
| `--glow-amber` | `rgba(255,159,28,.22)` | Glow card aktif/hover |

### 2.2 Tipografi

| Token | Nilai |
|---|---|
| `--ui` (font UI) | `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` |
| `--mono` (angka) | `'JetBrains Mono', 'Space Mono', ui-monospace, 'SF Mono', Menlo, monospace` |
| Heading weight | `800`, `letter-spacing: -.022em` |
| Number feature | `font-variant-numeric: tabular-nums; font-feature-settings:"tnum","ss01"` |
| `--fs-label` | `0.72rem` uppercase, `letter-spacing .06em` |
| `--fs-value` | `1.7rem` weight 700 |
| `--fs-value-lg` | `2.0rem` |
| h1 / h2 / h3 | `1.85rem` / `1.3rem` / `1.08rem` |

### 2.3 Spacing, radius, shadow, motion

| Token | Nilai |
|---|---|
| `--sp-1..5` | `4px / 8px / 12px / 16px / 24px` (skala 8px) |
| `--gutter` | `16px` (gap antar card) |
| block-container padding-top | `1.4rem` (rapat) |
| max-width | `1480px` |
| `--r-sm` / `--r` / `--r-lg` / `--r-pill` | `8px / 12px / 16px / 999px` |
| `--sh-card` | `0 8px 24px -8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)` |
| `--sh-glow` | `0 0 0 1px var(--glow-amber), 0 8px 30px -10px var(--glow-amber)` |
| `--blur` (glass) | `blur(14px) saturate(140%)` (+ `-webkit-` untuk Safari) |
| `--t` / `--t-slow` | `160ms cubic-bezier(.4,0,.2,1)` / `320ms ...` |
| `--ease-in` (fade) | `cubic-bezier(.16,1,.3,1)` |

---

## 3. Tech Stack UI FINAL

### 3.1 Dipakai

| Library | Versi (pin) | Untuk apa |
|---|---|---|
| **CSS custom** via `st.markdown(unsafe_allow_html=True)` | — | Tulang punggung tema (chrome hidden, glass card, KPI, ticker, tabs, sidebar, dataframe, scrollbar). Zero-risk, sudah ada di app. |
| **Native theming** `[theme]` di `config.toml` | Streamlit 1.58 | Dasar: `font`, `headingFont`, `codeFont`, `baseRadius`, `borderColor` — supaya widget base-web konsisten DULU, CSS hanya tambal sisanya. |
| `streamlit-option-menu` | `==0.4.0` | Menu sidebar premium (ikon Bootstrap, hover, highlight aktif). **Tetap di atas `st.navigation` sebagai lapisan visual**, bukan pengganti router. |
| `streamlit-extras` | `==1.6.0` | `style_metric_cards`, `grid`, `colored_header` — opsi cepat bila tak mau KPI HTML manual. Library paling aktif & aman (Mei 2026, Python ≥3.10). |
| **TradingView embed widgets** via `st.components.v1.html` | — (gratis, tanpa pip) | Ticker Tape, Advanced Real-Time Chart, Mini Symbol Overview. Faktor "wow" terbesar dengan effort terkecil. Zero-maintenance. |
| `plotly` | `>=6.8` (sudah ada) | Chart dengan data internal (yfinance) — candlestick + volume. Sudah dipakai di `ui/charts.py`, tinggal poles template. |

`requirements.txt` tambahan:
```
streamlit-option-menu==0.4.0
streamlit-extras==1.6.0
# opsional (lihat §3.2): streamlit-lightweight-charts-v5==0.1.8
# opsional: streamlit-aggrid==1.2.1.post2
```

### 3.2 Sengaja TIDAK dipakai (atau opsional dengan catatan)

| Library | Status | Alasan / risiko |
|---|---|---|
| `streamlit-elements` | **DIHINDARI** | Rilis terakhir 0.1.0 (April 2022), ~4 tahun tak terawat. Material UI + Nivo + draggable paling sering rusak di Streamlit modern (iframe height, event sync). Jangan jadi dependensi inti. |
| `streamlit-aggrid` | **Opsional** (`==1.2.1.post2`) | Grid pro powerful, tapi v1.x sempat dicap unstable oleh maintainer; resmi cap Python ≤3.13. Untuk app personal, `st.dataframe` styled atau **watchlist HTML kustom** sudah cukup & zero-risk. Pakai HANYA bila butuh sort/filter/pin kolom berat. |
| `streamlit-lightweight-charts` (freyastreamlit) | **DIHINDARI** | v0.7.20 (Mei 2023), stale, wheel lama berisiko di Python 3.14. Jika butuh, pakai fork **`streamlit-lightweight-charts-v5`** (locupleto, Des 2025). |
| `streamlit-lightweight-charts-v5` | **Opsional, beta** | Hanya bila perlu render data privat (entry/cost-average) di chart TradingView-style. TradingView embed sudah cukup untuk visual; plotly cukup untuk data internal. Pin `==0.1.8`. |
| `streamlit-shadcn-ui` | **Aksen saja** | Update jarang (0.1.19, Okt 2025), kadang rewel. Badge/card bisa direplika via CSS `.pill` yang sudah ada. |
| `locale.setlocale` (format ID) | **DIHINDARI** | Sering gagal di Windows (locale tak terpasang). Pakai helper `fmt_id` manual. |
| Class `.st-emotion-cache-*` | **DIHINDARI keras** | Hash berubah tiap rebuild/upgrade. SEMUA selector pakai `data-testid` yang terverifikasi di bundle 1.58.0. |

> **Catatan runtime penting:** brief menyebut Python 3.14, tapi `streamlit-extras`/`aggrid` resmi cap dukungan ≤3.13 dan komponen dengan frontend native belum tentu punya wheel 3.14. **Rekomendasi: jalankan venv di Python 3.12/3.13** agar `streamlit-option-menu` & `streamlit-extras` ter-install mulus. Jika harus tetap 3.14, andalkan **CSS murni + TradingView embed + plotly** (semua tanpa wheel native) dan lewati option-menu/extras.

---

## 4. GLOBAL CSS Final (siap-tempel ke `ui/theme.py`)

> Pola: `@import` font WAJIB jadi aturan pertama dalam `<style>`-nya sendiri → dipisah ke `_FONTS`, disuntik lebih dulu. Lalu `_CSS` (tema utama) + `_COMPONENTS_CSS` (KPI/ticker/section). SEMUA disuntik sekali via `inject_theme()` — JANGAN suntik di dalam `@st.fragment`.

```python
# ui/theme.py — GANTI TOTAL isi file lama dengan ini.
"""Tema 'IDX Terminal' gelap premium: CSS global + helper komponen HTML."""
from __future__ import annotations

import streamlit as st

UP = "#26a69a"
DOWN = "#ef5350"
FLAT = "#7a869a"

# ── 1) FONT (terpisah, @import wajib paling atas) ────────────────────────────
_FONTS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
</style>
"""

# ── 2) CSS UTAMA ─────────────────────────────────────────────────────────────
_CSS = """
<style>
:root{
  --bg-0:#07090f; --bg-1:#0b0e14; --bg-2:#11151d; --bg-3:#151a23; --bg-elev:#1a2030;
  --stroke:#222b39; --stroke-strong:#2c3850;
  --text-hi:#e8edf5; --text:#c2cad6; --text-dim:#7a869a;
  --accent:#ff9f1c; --accent-2:#4d8dff;
  --up:#26a69a; --up-bright:#0ecb81; --up-soft:rgba(38,166,154,.14);
  --down:#ef5350; --down-bright:#f6465d; --down-soft:rgba(239,83,80,.14);
  --flat:#7a869a; --glow-amber:rgba(255,159,28,.22);
  --r-sm:8px; --r:12px; --r-lg:16px; --r-pill:999px;
  --sh-card:0 8px 24px -8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04);
  --t:160ms cubic-bezier(.4,0,.2,1);
  --ui:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --mono:'JetBrains Mono','Space Mono',ui-monospace,'SF Mono',Menlo,monospace;
}

/* ---- Font global ---- */
html, body, [class*="st-"], .stApp, [data-testid="stMarkdownContainer"]{ font-family:var(--ui); }

/* ============ 1. SEMBUNYIKAN CHROME BAWAAN ============ */
[data-testid="stHeader"],
[data-testid="stToolbar"],
[data-testid="stToolbarActions"],
[data-testid="stMainMenu"],
[data-testid="stStatusWidget"],
[data-testid="stAppDeployButton"],
[data-testid="stDecoration"]{ display:none !important; }
[data-testid="stHeader"]{ height:0 !important; }
#MainMenu, footer{ visibility:hidden; height:0; }
[data-testid="stElementToolbar"]{ opacity:0; transition:opacity var(--t); }
[data-testid="stElementToolbar"]:hover{ opacity:1; }

/* ============ 2. BACKGROUND GELAP BERLAPIS ============ */
.stApp, [data-testid="stAppViewContainer"]{
  background:
    radial-gradient(1200px 600px at 78% -8%, rgba(255,159,28,.06), transparent 60%),
    radial-gradient(900px 500px at 0% 0%, rgba(77,141,255,.05), transparent 55%),
    linear-gradient(180deg,#0b0e14 0%, #07090f 100%);
  background-attachment:fixed;
}
/* grid halus terminal (hapus blok ini bila terasa ramai) */
[data-testid="stMain"]::before{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.35;
  background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
  background-size:40px 40px;
}
[data-testid="stMainBlockContainer"]{
  padding-top:1.4rem; padding-bottom:3rem; max-width:1480px; position:relative; z-index:1;
}

/* ============ 3. TIPOGRAFI ============ */
h1,h2,h3{ font-family:var(--ui); font-weight:800; letter-spacing:-.022em; color:var(--text-hi); }
h1{ font-size:1.85rem; line-height:1.15; }
h2{ font-size:1.3rem; } h3{ font-size:1.08rem; }
[data-testid="stMarkdownContainer"] p{ color:var(--text); }
.stCaption, [data-testid="stCaptionContainer"]{ color:var(--text-dim) !important; }
[data-testid="stMetricValue"], [data-testid="stMetricDelta"],
[data-testid="stDataFrame"], .mono, .kpi-val, .tick-px{
  font-family:var(--mono); font-variant-numeric:tabular-nums; font-feature-settings:"tnum";
}

/* ============ 4a. st.metric -> kartu glass ============ */
[data-testid="stMetric"]{
  background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0)), var(--bg-3);
  border:1px solid var(--stroke); border-radius:var(--r-lg);
  padding:14px 16px 12px; box-shadow:var(--sh-card);
  transition:transform var(--t), border-color var(--t), box-shadow var(--t);
}
[data-testid="stMetric"]:hover{ transform:translateY(-2px); border-color:var(--stroke-strong);
  box-shadow:0 12px 30px -10px rgba(0,0,0,.6), 0 0 0 1px var(--glow-amber); }
[data-testid="stMetricLabel"]{ color:var(--text-dim); font-size:.74rem; font-weight:600;
  text-transform:uppercase; letter-spacing:.06em; }
[data-testid="stMetricValue"]{ font-size:1.7rem; font-weight:700; color:var(--text-hi); }
[data-testid="stMetricDelta"]{ font-size:.85rem; font-weight:600; }

/* ============ 4b. Tombol ============ */
[data-testid="stButton"] > button, .stButton button{
  border-radius:var(--r); border:1px solid var(--stroke-strong);
  background:var(--bg-elev); color:var(--text-hi); font-weight:600;
  transition:transform var(--t), box-shadow var(--t), background var(--t), border-color var(--t);
}
[data-testid="stButton"] > button:hover{ transform:translateY(-1px); border-color:var(--accent);
  box-shadow:0 6px 18px -6px var(--glow-amber); }
[data-testid="stButton"] > button:active{ transform:translateY(0); }
.stButton button[data-testid="stBaseButton-primary"]{
  background:linear-gradient(180deg,#ffb047,#ff9f1c); color:#1a1206; border:none;
  box-shadow:0 6px 18px -6px var(--glow-amber);
}
.stButton button[data-testid="stBaseButton-primary"]:hover{ filter:brightness(1.06); }
/* form submit button (Pengaturan: "Tambah") */
.stFormSubmitButton button{ border-radius:var(--r); font-weight:600; }

/* ============ 4c. Input / Selectbox / NumberInput ============ */
[data-baseweb="input"], [data-baseweb="select"] > div,
[data-testid="stTextInput"] input, [data-testid="stNumberInput"] input{
  background:var(--bg-2) !important; border-radius:var(--r) !important;
  border:1px solid var(--stroke) !important; color:var(--text-hi) !important;
  transition:border-color var(--t), box-shadow var(--t);
}
[data-baseweb="input"]:focus-within, [data-baseweb="select"] > div:focus-within{
  border-color:var(--accent) !important; box-shadow:0 0 0 3px var(--glow-amber) !important;
}
[data-testid="stWidgetLabel"] p{ color:var(--text-dim); font-size:.78rem; font-weight:600;
  text-transform:uppercase; letter-spacing:.05em; }
[data-baseweb="popover"] [role="listbox"], [data-baseweb="menu"]{
  background:var(--bg-2) !important; border:1px solid var(--stroke) !important;
  border-radius:var(--r) !important; box-shadow:var(--sh-card) !important;
}

/* ---- segmented_control (Periode chart) ---- */
[data-testid="stSegmentedControl"] button{
  border-radius:var(--r-sm) !important; font-family:var(--mono); font-weight:600;
}
[data-testid="stSegmentedControl"] button[aria-checked="true"]{
  background:var(--accent) !important; color:#1a1206 !important; border-color:transparent !important;
}

/* ============ 4d. Tabs -> pill underline ============ */
[data-testid="stTabs"] [data-baseweb="tab-list"]{ gap:4px; border-bottom:1px solid var(--stroke); }
[data-testid="stTabs"] [data-baseweb="tab"]{
  background:transparent; color:var(--text-dim); border-radius:var(--r-sm) var(--r-sm) 0 0;
  padding:8px 14px; font-weight:600; transition:color var(--t), background var(--t);
}
[data-testid="stTabs"] [data-baseweb="tab"]:hover{ color:var(--text-hi); background:rgba(255,255,255,.03); }
[data-testid="stTabs"] [data-baseweb="tab"][aria-selected="true"]{ color:var(--accent); }
[data-testid="stTabs"] [data-baseweb="tab-highlight"]{ background:var(--accent) !important; height:2px; }

/* ============ 4e. Sidebar ============ */
[data-testid="stSidebar"]{ background:linear-gradient(180deg,#0d111a,#090c12);
  border-right:1px solid var(--stroke); }
[data-testid="stSidebarContent"]{ padding-top:1rem; }
[data-testid="stSidebarNav"] a{ border-radius:var(--r-sm); transition:background var(--t); }
[data-testid="stSidebarNav"] a:hover{ background:rgba(255,255,255,.04); }
[data-testid="stSidebarNav"] a[aria-current="page"]{
  background:var(--up-soft); border-left:2px solid var(--accent);
}
.brand{ font-family:var(--ui); font-size:1.18rem; font-weight:800; letter-spacing:-.02em; color:var(--text-hi); }
.brand .accent{ color:var(--accent); }

/* ============ 4f. st.dataframe ============ */
[data-testid="stDataFrame"]{ border:1px solid var(--stroke); border-radius:var(--r-lg);
  overflow:hidden; box-shadow:var(--sh-card); }
[data-testid="stDataFrame"] [role="columnheader"]{
  background:var(--bg-2) !important; color:var(--text-dim) !important;
  text-transform:uppercase; font-size:.72rem; letter-spacing:.05em; font-weight:700;
}
[data-testid="stDataFrame"] [role="row"]:hover [role="gridcell"]{ background:rgba(255,255,255,.03) !important; }

/* ============ 4g. Expander / Alert / Divider ============ */
[data-testid="stExpander"]{ border:1px solid var(--stroke); border-radius:var(--r-lg); background:var(--bg-3); }
[data-testid="stAlert"]{ border-radius:var(--r); border:1px solid var(--stroke); }
hr{ border-color:var(--stroke) !important; }

/* ============ 5. SCROLLBAR KUSTOM ============ */
*::-webkit-scrollbar{ width:10px; height:10px; }
*::-webkit-scrollbar-track{ background:transparent; }
*::-webkit-scrollbar-thumb{ background:var(--stroke-strong); border-radius:var(--r-pill);
  border:2px solid transparent; background-clip:padding-box; }
*::-webkit-scrollbar-thumb:hover{ background:#3a4763; }
html{ scrollbar-color:var(--stroke-strong) transparent; scrollbar-width:thin; }

/* ============ 6. ANIMASI ============ */
@keyframes fadeUp{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }
[data-testid="stMainBlockContainer"] > div{ animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both; }
@media (prefers-reduced-motion:reduce){ *{ animation:none !important; transition:none !important; } }

/* ---- pill naik/turun (dipertahankan dari app, dipoles) ---- */
.pill{ display:inline-block; padding:2px 10px; border-radius:var(--r-pill); font-family:var(--mono);
  font-size:.78rem; font-weight:600; line-height:1.5; }
.pill-up{ background:var(--up-soft); color:var(--up-bright); }
.pill-down{ background:var(--down-soft); color:var(--down-bright); }
.pill-flat{ background:rgba(122,134,154,.15); color:var(--flat); }
.muted{ color:var(--text-dim); }
</style>
"""

# ── 3) CSS KOMPONEN (KPI, ticker, section, watchlist HTML) ───────────────────
_COMPONENTS_CSS = """
<style>
/* ---- KPI card kustom ---- */
.kpi{ position:relative; background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0)), var(--bg-3);
  border:1px solid var(--stroke); border-radius:16px; padding:14px 16px 13px; overflow:hidden;
  box-shadow:var(--sh-card); transition:transform var(--t),border-color var(--t),box-shadow var(--t); }
.kpi:hover{ transform:translateY(-3px); border-color:var(--stroke-strong);
  box-shadow:0 16px 36px -12px rgba(0,0,0,.65); }
.kpi::after{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--flat); }
.kpi.up::after{ background:var(--up); } .kpi.down::after{ background:var(--down); }
.kpi-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
.kpi-label{ font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-dim);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.kpi-code{ font-family:var(--mono); font-size:.7rem; color:var(--text-dim); opacity:.85; }
.kpi-val{ font-size:1.7rem; font-weight:700; color:var(--text-hi); margin-top:2px; line-height:1.1; }
.kpi-delta{ display:inline-flex; align-items:center; gap:5px; margin-top:6px; font-family:var(--mono);
  font-size:.82rem; font-weight:600; padding:2px 9px; border-radius:999px; }
.kpi.up .kpi-delta{ background:var(--up-soft); color:var(--up-bright); }
.kpi.down .kpi-delta{ background:var(--down-soft); color:var(--down-bright); }
.kpi.flat .kpi-delta{ background:rgba(122,134,154,.15); color:var(--flat); }

/* ---- Ticker tape marquee ---- */
.ticker{ position:relative; overflow:hidden; white-space:nowrap; border:1px solid var(--stroke);
  border-radius:12px; background:linear-gradient(180deg,var(--bg-2),var(--bg-1));
  box-shadow:var(--sh-card); margin-bottom:18px; }
.ticker::before,.ticker::after{ content:""; position:absolute; top:0; bottom:0; width:60px; z-index:2; pointer-events:none; }
.ticker::before{ left:0; background:linear-gradient(90deg,var(--bg-1),transparent); }
.ticker::after{ right:0; background:linear-gradient(270deg,var(--bg-1),transparent); }
.ticker-track{ display:inline-flex; padding:9px 0; animation:ticker 40s linear infinite; }
.ticker:hover .ticker-track{ animation-play-state:paused; }
.tick{ display:inline-flex; align-items:baseline; gap:7px; padding:0 22px; border-right:1px solid var(--stroke);
  font-family:var(--mono); font-size:.84rem; }
.tick-sym{ color:var(--text-hi); font-weight:700; }
.tick-px{ color:var(--text); }
.tick.up .tick-chg{ color:var(--up-bright); } .tick.down .tick-chg{ color:var(--down-bright); }
.tick.flat .tick-chg{ color:var(--flat); }
.tick-chg{ font-weight:600; }
@keyframes ticker{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }

/* ---- Section header ---- */
.sec{ display:flex; align-items:center; gap:10px; margin:6px 0 10px; }
.sec-bar{ width:4px; height:18px; border-radius:2px; background:linear-gradient(180deg,var(--accent),#ff7a1c); }
.sec-title{ font-weight:800; letter-spacing:-.01em; color:var(--text-hi); font-size:1.05rem; }
.sec-meta{ margin-left:auto; font-family:var(--mono); font-size:.74rem; color:var(--text-dim); }

/* ---- Status bar (jam pasar) ---- */
.statusbar{ display:flex; gap:18px; align-items:center; padding:8px 14px; margin-bottom:14px;
  background:var(--bg-2); border:1px solid var(--stroke); border-radius:var(--r);
  font-family:var(--mono); font-size:.78rem; color:var(--text-dim); }
.statusbar .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:6px; }
.statusbar .open .dot{ background:var(--up-bright); box-shadow:0 0 8px var(--up-bright); }
.statusbar .closed .dot{ background:var(--down-bright); }
.statusbar b{ color:var(--text-hi); }

/* ---- Watchlist table HTML kustom (opsi premium, lihat §5d) ---- */
.wl{ width:100%; border-collapse:separate; border-spacing:0; font-family:var(--mono);
  border:1px solid var(--stroke); border-radius:var(--r-lg); overflow:hidden; box-shadow:var(--sh-card); }
.wl th{ background:var(--bg-2); color:var(--text-dim); text-transform:uppercase; font-size:.68rem;
  letter-spacing:.06em; font-weight:700; text-align:right; padding:9px 14px; }
.wl th:first-child, .wl th:nth-child(2){ text-align:left; }
.wl td{ padding:10px 14px; border-top:1px solid var(--stroke); text-align:right; color:var(--text); font-size:.86rem; }
.wl tr:hover td{ background:rgba(255,255,255,.03); }
.wl .c-code{ text-align:left; color:var(--text-hi); font-weight:700; }
.wl .c-name{ text-align:left; font-family:var(--ui); color:var(--text-dim); }
.wl .up{ color:var(--up-bright); font-weight:600; } .wl .down{ color:var(--down-bright); font-weight:600; }
.wl .flat{ color:var(--flat); }
</style>
"""


def inject_theme() -> None:
    """Suntik SEMUA CSS statis sekali. Panggil di app.py. JANGAN panggil di fragment."""
    st.markdown(_FONTS, unsafe_allow_html=True)
    st.markdown(_CSS, unsafe_allow_html=True)
    st.markdown(_COMPONENTS_CSS, unsafe_allow_html=True)
```

---

## 5. Komponen per Bagian

### (a) Sidebar nav — `streamlit-option-menu` (lapisan visual di atas `st.navigation`)

`st.navigation` TETAP jadi router (deep-link + state halaman bawaan). `option-menu` hanya merender menu cantik dan memanggil `st.switch_page()`.

```python
# app.py — di dalam `with st.sidebar:`
from streamlit_option_menu import option_menu

PAGES = {"Dashboard": "pages/dashboard.py", "Pengaturan": "pages/settings.py"}

with st.sidebar:
    st.markdown('<div class="brand">📈 Saham <span class="accent">Monitor</span></div>',
                unsafe_allow_html=True)
    st.caption("Personal IHSG terminal")
    selected = option_menu(
        menu_title=None, options=list(PAGES.keys()),
        icons=["graph-up-arrow", "gear"], default_index=0,
        styles={
            "container": {"padding": "4px 0", "background-color": "transparent"},
            "icon": {"color": "#7a869a", "font-size": "15px"},
            "nav-link": {"font-size": "14px", "color": "#c2cad6",
                         "--hover-color": "#1a2030", "border-radius": "8px",
                         "margin": "2px 0", "font-family": "Inter, sans-serif"},
            "nav-link-selected": {"background-color": "rgba(255,159,28,0.14)",
                                  "color": "#ff9f1c", "font-weight": "600"},
        },
    )
target = PAGES[selected]
if st.session_state.get("_active_page") != target:
    st.session_state["_active_page"] = target
    st.switch_page(target)
```

> **Fallback tanpa dependensi** (Python 3.14 / nol-risiko): hapus `option_menu`, biarkan `st.navigation` apa adanya — CSS `[data-testid="stSidebarNav"] a[aria-current="page"]` di §4 sudah memberi highlight aktif amber yang rapi. Komponen iframe option-menu TIDAK ikut CSS global, jadi warna diset lewat `styles=` (sudah selaras token).

### (b) Ticker tape atas

Dua opsi — pilih salah satu.

**B1 — TradingView embed (paling "wow", real symbol IDX):**

```python
# ui/charts.py — tambahkan
import streamlit.components.v1 as components

def tv_ticker_tape(symbols: list[str], height: int = 78) -> None:
    """Ticker tape TradingView. symbols = list yfinance ('^JKSE','BBCA.JK')."""
    tv = [{"proName": to_tv_symbol(s), "title": s.replace(".JK","").replace("^JKSE","IHSG")}
          for s in symbols]
    import json
    cfg = json.dumps({"symbols": tv, "showSymbolLogo": True, "isTransparent": True,
                      "displayMode": "adaptive", "colorTheme": "dark", "locale": "id"})
    components.html(f"""
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <script type="text/javascript"
    src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js" async>
  {cfg}
  </script>
</div>""", height=height)

def to_tv_symbol(sym: str) -> str:
    """yfinance -> TradingView. '^JKSE'->'IDX:COMPOSITE'; 'BBCA.JK'->'IDX:BBCA'."""
    if sym == "^JKSE":
        return "IDX:COMPOSITE"
    if sym.endswith(".JK"):
        return "IDX:" + sym[:-3]
    return sym
```
> Penting: IHSG = `IDX:COMPOSITE` (BUKAN `IDX:IHSG`/`IDX:JKSE`). Saham `BBCA.JK` → `IDX:BBCA`. `components.html` WAJIB diberi `height` eksplisit. Saham IDX tier gratis = delayed (~15-20 mnt), jangan klaim real-time.

**B2 — Ticker HTML kustom (data internal, tanpa internet ekstra):**

```python
# ui/theme.py — tambahkan
def ticker_tape(items: list[dict]) -> None:
    """items: [{'sym','price','pct'}]. Konten diduplikasi 2x untuk loop mulus."""
    def cell(it):
        p = it.get("pct", 0.0)
        cls = "up" if p > 0 else "down" if p < 0 else "flat"
        arrow = "▲" if p > 0 else "▼" if p < 0 else "▪"
        return (f'<span class="tick {cls}"><span class="tick-sym">{it["sym"]}</span>'
                f'<span class="tick-px">{it["price"]}</span>'
                f'<span class="tick-chg">{arrow} {p:+.2f}%</span></span>')
    row = "".join(cell(i) for i in items)
    st.markdown(f'<div class="ticker"><div class="ticker-track">{row}{row}</div></div>',
                unsafe_allow_html=True)
```
> `row+row` + `translateX(-50%)` = loop seamless GPU-accelerated. Hover = pause.

### (c) KPI cards kustom

```python
# ui/theme.py — tambahkan
def kpi_card(label: str, value: str, change: float = 0.0, pct: float = 0.0, code: str = "") -> None:
    if change > 0: cls, arrow = "up", "▲"
    elif change < 0: cls, arrow = "down", "▼"
    else: cls, arrow = "flat", "▪"
    delta = f"{arrow} {change:+,.2f} ({pct:+.2f}%)" if (change or pct) else "—"
    html = (f'<div class="kpi {cls}"><div class="kpi-top">'
            f'<span class="kpi-label">{label}</span><span class="kpi-code">{code}</span></div>'
            f'<div class="kpi-val">{value}</div>'
            f'<span class="kpi-delta">{delta}</span></div>')
    st.markdown(html, unsafe_allow_html=True)

def section_header(title: str, meta: str = "") -> None:
    m = f'<span class="sec-meta">{meta}</span>' if meta else ""
    st.markdown(f'<div class="sec"><span class="sec-bar"></span>'
                f'<span class="sec-title">{title}</span>{m}</div>', unsafe_allow_html=True)

def status_bar(is_open: bool, updated: str, source: str = "yfinance · delayed ~15–20 mnt") -> None:
    state, label = ("open", "PASAR BUKA") if is_open else ("closed", "PASAR TUTUP")
    st.markdown(f'<div class="statusbar"><span class="{state}"><span class="dot"></span>'
                f'<b>{label}</b></span><span>⟳ {updated} WIB</span>'
                f'<span style="margin-left:auto">{source}</span></div>', unsafe_allow_html=True)
```
> HTML dirangkai satu baris tanpa indentasi (hindari Streamlit menafsirkannya sebagai code block).

### (d) Watchlist table premium

**Opsi default (zero-risk):** pertahankan `st.dataframe` styled yang sudah ada — CSS §4f sudah mempercantik (header sticky uppercase, hover row, border, mono). `.map(utils.css_updown)` dari pandas Styler tetap menang (inline style) untuk warna Δ. Tambahkan `column_config` agar angka rata kanan konsisten:

```python
st.dataframe(styled, width="stretch", hide_index=True, column_config={
    "Terakhir": st.column_config.NumberColumn("TERAKHIR"),
    "Volume": st.column_config.NumberColumn("VOLUME"),
})
```

**Opsi premium (HTML + sparkline arah):** render tabel sebagai HTML penuh (kontrol total). Tambahkan ke `ui/theme.py`:

```python
def watchlist_table(rows: list[dict]) -> None:
    """rows: [{'code','name','last','chg','pct','vol'}] — semua sudah ter-format str/num."""
    def klass(v): return "up" if v > 0 else "down" if v < 0 else "flat"
    def arr(v):  return "▲" if v > 0 else "▼" if v < 0 else "▪"
    body = ""
    for r in rows:
        k = klass(r["pct"])
        body += (f'<tr><td class="c-code">{r["code"]}</td><td class="c-name">{r["name"]}</td>'
                 f'<td>{r["last"]}</td>'
                 f'<td class="{k}">{arr(r["pct"])} {r["chg"]}</td>'
                 f'<td class="{k}">{r["pct"]:+.2f}%</td>'
                 f'<td class="muted">{r["vol"]}</td></tr>')
    st.markdown(
        '<table class="wl"><thead><tr><th>Kode</th><th>Nama</th><th>Terakhir</th>'
        '<th>Δ</th><th>Δ%</th><th>Volume</th></tr></thead>'
        f'<tbody>{body}</tbody></table>', unsafe_allow_html=True)
```
> Untuk **sparkline mini per baris**: pakai TradingView Mini Symbol Overview per emiten di grid kartu (`embed-widget-mini-symbol-overview.js`, `colorTheme:"dark"`, `isTransparent:true`), ATAU `streamlit-aggrid` (`==1.2.1.post2`, `allow_unsafe_jscode=True`) bila butuh sort/filter interaktif. Untuk app personal, tabel HTML di atas + arah panah sudah memberi 90% kesan premium tanpa dependensi.

### (e) Chart — TradingView embed + mapping simbol IDX

Chart utama detail saham. `to_tv_symbol()` (lihat §5b) adalah kuncinya.

```python
# ui/charts.py — tambahkan
def tv_advanced_chart(symbol: str, height: int = 480) -> None:
    """Advanced Real-Time Chart TradingView (dark, transparan)."""
    import json
    cfg = json.dumps({
        "symbol": to_tv_symbol(symbol), "interval": "D", "timezone": "Asia/Jakarta",
        "theme": "dark", "style": "1", "locale": "id", "isTransparent": True,
        "hide_top_toolbar": False, "allow_symbol_change": False, "autosize": True,
        "backgroundColor": "rgba(11,14,20,1)", "gridColor": "rgba(42,46,57,0.4)",
    })
    components.html(f"""
<div class="tradingview-widget-container" style="height:{height}px">
  <div class="tradingview-widget-container__widget" style="height:100%"></div>
  <script type="text/javascript"
    src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
  {cfg}
  </script>
</div>""", height=height + 8)
```

**Mapping simbol IDX (taruh `to_tv_symbol` di `utils.py` agar reusable):**

| yfinance (app) | TradingView |
|---|---|
| `^JKSE` (IHSG) | `IDX:COMPOSITE` |
| `BBCA.JK` | `IDX:BBCA` |
| `ANTM.JK` | `IDX:ANTM` |
| `AAPL` (non-IDX) | `AAPL` (apa adanya) |

**Plotly tetap** untuk chart yang butuh data internal (index `^JKSE` line, atau penanda entry/cost-average nanti). Poles `ui/charts.py` agar menyatu:

```python
# ui/charts.py — di dalam candlestick(), ganti font + hover agar terminal
fig.update_layout(
    template="plotly_dark", height=540, margin=dict(l=8, r=8, t=24, b=8),
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    xaxis_rangeslider_visible=False, hovermode="x unified", dragmode="pan",
    font=dict(family="Inter, sans-serif", size=12, color="#c2cad6"),
    hoverlabel=dict(bgcolor="#11151d", bordercolor="#2c3850",
                    font=dict(family="JetBrains Mono", color="#e8edf5")),
)
fig.update_xaxes(showgrid=True, gridcolor="rgba(255,255,255,0.05)",
                 tickfont=dict(family="JetBrains Mono", size=11, color="#7a869a"))
fig.update_yaxes(showgrid=True, gridcolor="rgba(255,255,255,0.05)",
                 tickfont=dict(family="JetBrains Mono", size=11, color="#7a869a"))
# ...dan saat render: st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
```

---

## 6. Rencana Penerapan ke File yang Ada

**Urutan kerja:** `config.toml` → `ui/theme.py` → `utils.py`/`ui/charts.py` → `app.py` → `pages/dashboard.py` → restart `streamlit run app.py`.

### 6.1 `.streamlit/config.toml` — tambah native theme tokens

Ganti isi `[theme]` (sejajarkan dengan token CSS):

```toml
[theme]
base = "dark"
primaryColor = "#ff9f1c"
backgroundColor = "#0b0e14"
secondaryBackgroundColor = "#151a23"
textColor = "#e8edf5"                  # naikkan dari #e6e6e6 -> selaras --text-hi
font = "Inter, sans-serif"             # ganti "sans serif"
headingFont = "Inter, sans-serif"
codeFont = "JetBrains Mono, monospace"
baseRadius = "0.75rem"                 # ~12px
borderColor = "#222b39"                # = --stroke

[browser]
gatherUsageStats = false

[server]
headless = true
runOnSave = true
```

### 6.2 `ui/theme.py` — ganti total

- **GANTI** `_CSS` lama (47 baris) dengan `_FONTS` + `_CSS` + `_COMPONENTS_CSS` (§4).
- **UBAH** `inject_theme()` agar menyuntik ketiganya sekali.
- **PERTAHANKAN** `delta_pill()` (poles warna ke `--up-bright`/`--down-bright`).
- **TAMBAH** helper: `kpi_card()`, `section_header()`, `status_bar()`, `ticker_tape()`, `watchlist_table()` (opsional).

### 6.3 `utils.py` — tambah 1 helper + 1 formatter

- **TAMBAH** `to_tv_symbol(sym)` (§5e) — mapping IDX untuk TradingView.
- **TAMBAH** `fmt_id(x, dec=2)` untuk format Indonesia (`7.342,18`) — dipakai ticker/KPI:
  ```python
  def fmt_id(x, dec=2):
      s = f"{float(x):,.{dec}f}"          # '7,342.18'
      return s.replace(",", "\0").replace(".", ",").replace("\0", ".")
  ```
- **PERTAHANKAN** `css_updown`, `fmt_idr`, `fmt_pct`, `fmt_volume`, `market_status`, `now_wib`, `is_market_open` (sudah dipakai).

### 6.4 `ui/charts.py` — poles + 2 fungsi embed

- **TAMBAH** `import streamlit.components.v1 as components` + `to_tv_symbol` (atau import dari `utils`).
- **TAMBAH** `tv_ticker_tape()`, `tv_advanced_chart()` (§5b/§5e).
- **UBAH** `candlestick()` layout: tambah `font`, `hoverlabel` (§5e). Logika candlestick/volume tetap.

### 6.5 `app.py` — sidebar nav premium

- **UBAH** blok `with st.sidebar:` — sisipkan `option_menu` + `st.switch_page` (§5a). `inject_theme()` di baris 19 tetap (sekarang memuat font + CSS + komponen sekaligus).
- **PERTAHANKAN** `st.set_page_config` (baris 13, harus sebelum `inject_theme`) dan `st.navigation(...).run()` (baris 33-34) sebagai router.

### 6.6 `pages/dashboard.py` — penerapan komponen

| Baris saat ini | Aksi |
|---|---|
| `import` (1-11) | TAMBAH `from ui.theme import kpi_card, section_header, status_bar` (+ `ticker_tape` atau `from ui import charts` untuk `tv_ticker_tape`). |
| `st.title(...)` (13) | Di atasnya panggil ticker: `charts.tv_ticker_tape(symbols)` **atau** `ticker_tape([...])` dari quotes. |
| KPI loop `st.metric` (44-51) | GANTI dengan `kpi_card(utils.display_name(s), utils.fmt_idr(q.price), q.change, q.change_pct, utils.short_code(s))` di dalam `with col:`. Bungkus dengan `section_header("Ringkasan Pasar")`. |
| `st.markdown("##### Watchlist")` (53) | GANTI dengan `section_header("Watchlist")`. |
| `st.dataframe(styled, ...)` (77) | Pertahankan (CSS sudah mempercantik) + tambah `column_config` (§5d), ATAU pakai `watchlist_table(rows)`. |
| `st.caption(...)` status (79-83) | GANTI dengan `status_bar(utils.is_market_open(), f"{utils.now_wib():%H:%M:%S}")`. |
| Detail metric `st.columns(4)` (110-115) | Boleh tetap `st.metric` (sudah dirombak CSS), ATAU `kpi_card` untuk "Terakhir" saja. |
| `st.plotly_chart(charts.candlestick(...))` (119-122) | GANTI dengan `charts.tv_advanced_chart(sel)` untuk look TradingView; sisakan plotly untuk `^JKSE` (`if sel.startswith("^"): st.plotly_chart(...)`). Tambah `config={"displayModeBar": False}` pada plotly. |

### 6.7 `pages/settings.py` — minim perubahan

CSS global sudah mempercantik form/tombol/input. Opsional: ganti `st.subheader(...)` dengan `section_header(...)` untuk konsistensi. Tombol hapus 🗑️ dan "Tambah" sudah otomatis terstyle.

### 6.8 `requirements.txt` — tambah (pin versi)

```
streamlit-option-menu==0.4.0
streamlit-extras==1.6.0
```

---

### Gotchas kritis saat implementasi
1. **JANGAN** suntik `<style>` di dalam `@st.fragment(run_every=...)` (`live_section`) — akan menumpuk tiap auto-refresh. Semua CSS di `inject_theme()`. `kpi_card()`/`ticker_tape()`/`status_bar()` hanya keluarkan HTML → aman di dalam fragment.
2. **`st.set_page_config` wajib pertama** (sudah benar, baris 13 sebelum `inject_theme` baris 19).
3. HTML helper dirangkai **satu baris tanpa indentasi 4+ spasi** (hindari code-block markdown).
4. Komponen iframe (option-menu, TradingView embed) **TIDAK ikut CSS global** — warna diset via parameter (`styles=`, `theme`/`colorTheme`, `isTransparent`).
5. `components.html` **wajib `height` eksplisit**, kalau tidak iframe terpotong.
6. **Pin semua dependensi**; jalankan di **Python 3.12/3.13** bila pakai option-menu/extras (wheel 3.14 belum tentu ada).
7. Jika upgrade Streamlit nanti: re-grep `data-testid` di `static/static/js` untuk pastikan selector belum berubah. Jangan pernah pakai `.st-emotion-cache-*`.

File yang disentuh (semua absolut):
`C:\Users\ALDONI\Downloads\Saham Monitor\saham-monitor\.streamlit\config.toml`, `...\ui\theme.py`, `...\utils.py`, `...\ui\charts.py`, `...\app.py`, `...\pages\dashboard.py`, `...\pages\settings.py`, `...\requirements.txt`.