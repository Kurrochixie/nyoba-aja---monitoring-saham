"""Tema 'Fintech terang' (gaya Bibit): CSS global + helper komponen HTML.

Latar terang, kartu putih shadow lembut, sudut membulat, aksen hijau segar,
banyak whitespace, tipografi Inter. CSS disuntik SEKALI via inject_theme() di
app.py — JANGAN di dalam @st.fragment. Helper hanya keluarkan HTML (aman di fragment).
"""
from __future__ import annotations

import streamlit as st

UP = "#0e9f6e"
DOWN = "#e11d48"
FLAT = "#94a3b8"

# ── 1) FONT ──────────────────────────────────────────────────────────────────
_FONTS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block');
</style>
"""

# ── 2) CSS UTAMA ─────────────────────────────────────────────────────────────
_CSS = """
<style>
:root{
  --bg:#f5f7f9; --card:#ffffff; --bg-soft:#eef1f5;
  --stroke:#e9edf2; --stroke-2:#dfe5ec;
  --text:#0f172a; --text-2:#52617a; --text-dim:#9aa6b6;
  --accent:#16c784; --accent-d:#0ea76a; --accent-soft:#e6f9f1;
  --up:#16c784; --up-d:#0e9f6e; --up-soft:#e6f9f1;
  --down:#f6465d; --down-d:#e11d48; --down-soft:#fdebef; --flat:#9aa6b6;
  --r-sm:10px; --r:14px; --r-lg:20px; --r-pill:999px;
  --sh:0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06);
  --sh-md:0 6px 18px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.05);
  --sh-lg:0 16px 36px rgba(16,24,40,.12);
  --ui:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --t:.18s cubic-bezier(.4,0,.2,1);
}
html, body, [class*="st-"], .stApp, [data-testid="stMarkdownContainer"]{ font-family:var(--ui); }
[data-testid="stMetricValue"], [data-testid="stMetricDelta"], [data-testid="stDataFrame"],
.mono, .kpi-val, .tick-px, .num{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }

/* hide chrome */
[data-testid="stHeader"],[data-testid="stToolbar"],[data-testid="stToolbarActions"],
[data-testid="stMainMenu"],[data-testid="stStatusWidget"],[data-testid="stAppDeployButton"],
[data-testid="stDecoration"]{ display:none !important; }
[data-testid="stHeader"]{ height:0 !important; }
#MainMenu, footer{ visibility:hidden; height:0; }
[data-testid="stElementToolbar"]{ opacity:0; transition:opacity var(--t); }
[data-testid="stElementToolbar"]:hover{ opacity:1; }

/* background terang */
.stApp, [data-testid="stAppViewContainer"]{ background:var(--bg); }
[data-testid="stMainBlockContainer"]{ padding-top:2.2rem; padding-bottom:4rem; max-width:1320px; }

/* tipografi */
h1,h2,h3{ font-family:var(--ui); color:var(--text); letter-spacing:-.02em; }
h1{ font-size:1.95rem; font-weight:800; line-height:1.15; }
h2{ font-size:1.35rem; font-weight:800; } h3{ font-size:1.1rem; font-weight:700; }
[data-testid="stMarkdownContainer"] p{ color:var(--text-2); }
.stCaption, [data-testid="stCaptionContainer"]{ color:var(--text-dim) !important; }

/* st.metric -> kartu putih membulat */
[data-testid="stMetric"]{
  background:var(--card); border:1px solid var(--stroke); border-radius:var(--r-lg);
  padding:18px 20px 16px; box-shadow:var(--sh);
  transition:transform var(--t), box-shadow var(--t); }
[data-testid="stMetric"]:hover{ transform:translateY(-2px); box-shadow:var(--sh-md); }
[data-testid="stMetricLabel"]{ color:var(--text-dim); font-size:.8rem; font-weight:600; }
[data-testid="stMetricValue"]{ font-size:1.7rem; font-weight:800; color:var(--text); letter-spacing:-.01em; }
[data-testid="stMetricDelta"]{ font-size:.86rem; font-weight:700; }

/* tombol: pill, sekunder putih + primary hijau */
[data-testid="stButton"] > button, .stButton button{
  border-radius:var(--r-pill); border:1px solid var(--stroke-2); background:var(--card);
  color:var(--text); font-weight:600; padding:.5rem 1.15rem; box-shadow:var(--sh);
  transition:transform var(--t), box-shadow var(--t), border-color var(--t), color var(--t); }
[data-testid="stButton"] > button:hover{ transform:translateY(-1px); border-color:var(--accent);
  color:var(--accent-d); box-shadow:var(--sh-md); }
.stButton button[kind="primary"], button[data-testid="stBaseButton-primary"]{
  background:var(--accent); color:#fff; border:none; box-shadow:0 6px 16px rgba(22,199,132,.32); }
.stButton button[kind="primary"]:hover{ background:var(--accent-d); color:#fff; }
.stFormSubmitButton button{ border-radius:var(--r-pill); font-weight:700; background:var(--accent);
  color:#fff; border:none; box-shadow:0 6px 16px rgba(22,199,132,.32); }
.stFormSubmitButton button:hover{ background:var(--accent-d); transform:translateY(-1px); }

/* input / selectbox */
[data-baseweb="input"], [data-baseweb="select"] > div,
[data-testid="stTextInput"] input, [data-testid="stNumberInput"] input{
  background:var(--card) !important; border:1px solid var(--stroke-2) !important;
  border-radius:var(--r) !important; color:var(--text) !important; transition:border-color var(--t), box-shadow var(--t); }
[data-baseweb="input"]:focus-within, [data-baseweb="select"] > div:focus-within{
  border-color:var(--accent) !important; box-shadow:0 0 0 3px var(--accent-soft) !important; }
[data-testid="stWidgetLabel"] p{ color:var(--text-2); font-size:.82rem; font-weight:600; }
[data-baseweb="popover"] [role="listbox"], [data-baseweb="menu"]{
  background:var(--card) !important; border:1px solid var(--stroke) !important;
  border-radius:var(--r) !important; box-shadow:var(--sh-md) !important; }
[data-testid="stSegmentedControl"] button{ border-radius:var(--r-sm) !important; font-weight:600; }
[data-testid="stSegmentedControl"] button[aria-checked="true"]{
  background:var(--accent) !important; color:#fff !important; border-color:transparent !important; }

/* tabs */
[data-testid="stTabs"] [data-baseweb="tab-list"]{ gap:6px; border-bottom:1px solid var(--stroke); }
[data-testid="stTabs"] [data-baseweb="tab"]{ background:transparent; color:var(--text-dim);
  padding:9px 16px; font-weight:600; transition:color var(--t); }
[data-testid="stTabs"] [data-baseweb="tab"]:hover{ color:var(--text); }
[data-testid="stTabs"] [data-baseweb="tab"][aria-selected="true"]{ color:var(--accent-d); }
[data-testid="stTabs"] [data-baseweb="tab-highlight"]{ background:var(--accent) !important; height:3px; border-radius:3px; }

/* sidebar putih */
[data-testid="stSidebar"]{ background:var(--card); border-right:1px solid var(--stroke); }
[data-testid="stSidebarContent"]{ padding-top:1.2rem; }
[data-testid="stSidebarNav"]{ margin-top:.3rem; }
[data-testid="stSidebarNav"] a{ border-radius:var(--r-sm); margin:1px 6px; transition:background var(--t); }
[data-testid="stSidebarNav"] a:hover{ background:var(--bg-soft); }
[data-testid="stSidebarNav"] a[aria-current="page"]{ background:var(--accent-soft); }
[data-testid="stSidebarNav"] a[aria-current="page"] span{ color:var(--accent-d) !important; font-weight:700; }
.brand{ font-size:1.3rem; font-weight:800; letter-spacing:-.02em; color:var(--text); display:flex; align-items:center; gap:8px; }
.brand .accent{ color:var(--accent-d); }
.brand .ms{ color:var(--accent); font-size:1.5rem; vertical-align:-.22em; }

/* dataframe */
[data-testid="stDataFrame"]{ border:1px solid var(--stroke); border-radius:var(--r-lg); overflow:hidden; box-shadow:var(--sh); }
[data-testid="stDataFrame"] [role="columnheader"]{ background:var(--bg-soft) !important; color:var(--text-dim) !important;
  text-transform:uppercase; font-size:.72rem; letter-spacing:.04em; font-weight:700; }
[data-testid="stDataFrame"] [role="row"]:hover [role="gridcell"]{ background:var(--accent-soft) !important; }

/* expander / alert / divider */
[data-testid="stExpander"]{ border:1px solid var(--stroke); border-radius:var(--r-lg); background:var(--card); box-shadow:var(--sh); }
[data-testid="stAlert"]{ border-radius:var(--r); border:1px solid var(--stroke); }
hr{ border-color:var(--stroke) !important; }

/* scrollbar */
*::-webkit-scrollbar{ width:10px; height:10px; }
*::-webkit-scrollbar-track{ background:transparent; }
*::-webkit-scrollbar-thumb{ background:#cfd8e3; border-radius:var(--r-pill); border:2px solid transparent; background-clip:padding-box; }
*::-webkit-scrollbar-thumb:hover{ background:#b8c3d1; }

/* animasi */
@keyframes fadeUp{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }
[data-testid="stMainBlockContainer"] > div{ animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
@media (prefers-reduced-motion:reduce){ *{ animation:none !important; transition:none !important; } }

.ms{ font-family:'Material Symbols Rounded'; font-weight:normal; font-style:normal; line-height:1;
  display:inline-block; vertical-align:-.18em; -webkit-font-smoothing:antialiased;
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

.pill{ display:inline-block; padding:3px 11px; border-radius:var(--r-pill); font-size:.78rem; font-weight:700; }
.pill-up{ background:var(--up-soft); color:var(--up-d); }
.pill-down{ background:var(--down-soft); color:var(--down-d); }
.pill-flat{ background:#eef1f5; color:var(--flat); }
.muted{ color:var(--text-dim); }
</style>
"""

# ── 3) CSS KOMPONEN ──────────────────────────────────────────────────────────
_COMPONENTS_CSS = """
<style>
/* KPI card */
.kpi{ position:relative; background:var(--card); border:1px solid var(--stroke); border-radius:var(--r-lg);
  padding:18px 20px 16px; overflow:hidden; box-shadow:var(--sh); transition:transform var(--t), box-shadow var(--t); }
.kpi:hover{ transform:translateY(-3px); box-shadow:var(--sh-md); }
.kpi::after{ content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--flat); }
.kpi.up::after{ background:var(--up); } .kpi.down::after{ background:var(--down); }
.kpi-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
.kpi-label{ font-size:.78rem; font-weight:600; color:var(--text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.kpi-code{ font-size:.72rem; font-weight:600; color:var(--text-dim); opacity:.8; }
.kpi-val{ font-size:1.75rem; font-weight:800; color:var(--text); margin-top:4px; line-height:1.1; letter-spacing:-.01em; }
.kpi-delta{ display:inline-flex; align-items:center; gap:5px; margin-top:9px; font-size:.82rem; font-weight:700; padding:3px 10px; border-radius:var(--r-pill); }
.kpi.up .kpi-delta{ background:var(--up-soft); color:var(--up-d); }
.kpi.down .kpi-delta{ background:var(--down-soft); color:var(--down-d); }
.kpi.flat .kpi-delta{ background:#eef1f5; color:var(--flat); }

/* Ticker tape */
.ticker{ position:relative; overflow:hidden; white-space:nowrap; border:1px solid var(--stroke);
  border-radius:var(--r); background:var(--card); box-shadow:var(--sh); margin-bottom:20px; }
.ticker::before,.ticker::after{ content:""; position:absolute; top:0; bottom:0; width:50px; z-index:2; pointer-events:none; }
.ticker::before{ left:0; background:linear-gradient(90deg,var(--card),transparent); }
.ticker::after{ right:0; background:linear-gradient(270deg,var(--card),transparent); }
.ticker-track{ display:inline-flex; padding:10px 0; animation:ticker 48s linear infinite; }
.ticker:hover .ticker-track{ animation-play-state:paused; }
.tick{ display:inline-flex; align-items:baseline; gap:7px; padding:0 22px; border-right:1px solid var(--stroke); font-size:.84rem; }
.tick-sym{ color:var(--text); font-weight:700; } .tick-px{ color:var(--text-2); font-weight:600; }
.tick.up .tick-chg{ color:var(--up-d); } .tick.down .tick-chg{ color:var(--down-d); } .tick.flat .tick-chg{ color:var(--flat); }
.tick-chg{ font-weight:700; }
@keyframes ticker{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }

/* Section header */
.sec{ display:flex; align-items:center; gap:10px; margin:14px 0 14px; }
.sec-bar{ width:4px; height:20px; border-radius:3px; background:var(--accent); }
.sec-title{ font-weight:800; color:var(--text); font-size:1.12rem; letter-spacing:-.01em; }
.sec-meta{ margin-left:auto; font-size:.8rem; color:var(--text-dim); font-weight:600; }

/* Status bar */
.statusbar{ display:flex; gap:18px; align-items:center; padding:11px 16px; margin-bottom:18px;
  background:var(--card); border:1px solid var(--stroke); border-radius:var(--r); box-shadow:var(--sh);
  font-size:.82rem; color:var(--text-dim); font-weight:500; }
.statusbar .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:7px; }
.statusbar .open .dot{ background:var(--up); box-shadow:0 0 0 4px var(--up-soft); }
.statusbar .closed .dot{ background:var(--down); box-shadow:0 0 0 4px var(--down-soft); }
.statusbar b{ color:var(--text); font-weight:700; }
.statusbar .ms{ font-size:1.05em; vertical-align:-.2em; }

/* Watchlist table */
.wl{ width:100%; border-collapse:separate; border-spacing:0; background:var(--card);
  border:1px solid var(--stroke); border-radius:var(--r-lg); overflow:hidden; box-shadow:var(--sh); }
.wl th{ background:var(--bg-soft); color:var(--text-dim); text-transform:uppercase; font-size:.68rem;
  letter-spacing:.04em; font-weight:700; text-align:right; padding:11px 16px; }
.wl th:first-child, .wl th:nth-child(2), .wl th:nth-child(3){ text-align:left; }
.wl td{ padding:13px 16px; border-top:1px solid var(--stroke); text-align:right; color:var(--text-2);
  font-size:.88rem; vertical-align:middle; font-variant-numeric:tabular-nums; }
.wl tr:hover td{ background:var(--accent-soft); }
.wl .c-code{ text-align:left; color:var(--text); font-weight:800; }
.wl .c-name{ text-align:left; color:var(--text-2); max-width:230px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wl .c-spark{ text-align:left; width:120px; }
.wl .up{ color:var(--up-d); font-weight:700; } .wl .down{ color:var(--down-d); font-weight:700; } .wl .flat{ color:var(--flat); }

/* News card */
.news-item{ display:block; padding:14px 16px; border:1px solid var(--stroke); border-radius:var(--r);
  background:var(--card); margin-bottom:11px; text-decoration:none; box-shadow:var(--sh);
  transition:transform var(--t), box-shadow var(--t); }
.news-item:hover{ transform:translateY(-2px); box-shadow:var(--sh-md); }
.news-title{ color:var(--text); font-weight:700; font-size:.95rem; line-height:1.4; }
.news-meta{ margin-top:8px; font-size:.74rem; color:var(--text-dim); display:flex; gap:10px; align-items:center; font-weight:500; }
.sent{ padding:2px 9px; border-radius:var(--r-pill); font-size:.66rem; font-weight:700; text-transform:uppercase; }
.sent.positif{ background:var(--up-soft); color:var(--up-d); }
.sent.negatif{ background:var(--down-soft); color:var(--down-d); }
.sent.netral{ background:#eef1f5; color:var(--flat); }

/* Signal chip & verdict badge */
.sigchip{ display:inline-flex; flex-direction:column; gap:3px; padding:12px 16px; border:1px solid var(--stroke);
  border-radius:var(--r); background:var(--card); min-width:140px; box-shadow:var(--sh); }
.sigchip .s-name{ font-size:.68rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-dim); font-weight:600; }
.sigchip .s-val{ font-weight:800; font-size:1.1rem; }
.sigchip.up .s-val{ color:var(--up-d); } .sigchip.down .s-val{ color:var(--down-d); } .sigchip.flat .s-val{ color:var(--text); }
.vbadge{ display:inline-block; padding:6px 18px; border-radius:var(--r-pill); font-weight:800; letter-spacing:.03em; }
.vbadge.up{ background:var(--up-soft); color:var(--up-d); }
.vbadge.down{ background:var(--down-soft); color:var(--down-d); }
.vbadge.flat{ background:#eef1f5; color:var(--flat); }

/* Trade badge */
.tbadge{ font-size:.7rem; font-weight:800; padding:3px 10px; border-radius:var(--r-pill); }
.badge-buy{ background:var(--up-soft); color:var(--up-d); }
.badge-sell{ background:var(--down-soft); color:var(--down-d); }
</style>
"""


def inject_theme() -> None:
    st.markdown(_FONTS, unsafe_allow_html=True)
    st.markdown(_CSS, unsafe_allow_html=True)
    st.markdown(_COMPONENTS_CSS, unsafe_allow_html=True)


# ── Helper komponen HTML ─────────────────────────────────────────────────────
def _cls_arrow(v: float) -> tuple[str, str]:
    if v > 0:
        return "up", "▲"
    if v < 0:
        return "down", "▼"
    return "flat", "■"


def icon(name: str, size: str = "1em") -> str:
    return f'<span class="ms" style="font-size:{size}">{name}</span>'


def delta_pill(change: float, pct: float) -> str:
    cls, arrow = _cls_arrow(change)
    return f'<span class="pill pill-{cls}">{arrow} {change:+,.2f} ({pct:+.2f}%)</span>'


def kpi_card(label: str, value: str, change: float = 0.0, pct: float = 0.0, code: str = "") -> None:
    cls, arrow = _cls_arrow(change if change else pct)
    delta = f"{arrow} {change:+,.0f} ({pct:+.2f}%)" if (change or pct) else "—"
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
                f'<b>{label}</b></span><span><span class="ms">update</span> {updated} WIB</span>'
                f'<span style="margin-left:auto">{source}</span></div>', unsafe_allow_html=True)


def ticker_tape(items: list[dict]) -> None:
    def cell(it):
        cls, arrow = _cls_arrow(it.get("pct", 0.0))
        return (f'<span class="tick {cls}"><span class="tick-sym">{it["sym"]}</span>'
                f'<span class="tick-px">{it["price"]}</span>'
                f'<span class="tick-chg">{arrow} {it.get("pct", 0.0):+.2f}%</span></span>')
    row = "".join(cell(i) for i in items)
    st.markdown(f'<div class="ticker"><div class="ticker-track">{row}{row}</div></div>',
                unsafe_allow_html=True)


def watchlist_table(rows: list[dict]) -> None:
    body = ""
    for r in rows:
        cls, arrow = _cls_arrow(r["pct"])
        body += (f'<tr><td class="c-code">{r["code"]}</td>'
                 f'<td class="c-name">{r["name"]}</td>'
                 f'<td class="c-spark">{r.get("spark", "")}</td>'
                 f'<td>{r["last"]}</td>'
                 f'<td class="{cls}">{arrow} {r["chg"]}</td>'
                 f'<td class="{cls}">{r["pct"]:+.2f}%</td>'
                 f'<td class="muted">{r["vol"]}</td></tr>')
    st.markdown('<table class="wl"><thead><tr><th>Kode</th><th>Nama</th><th>Tren 30H</th>'
                '<th>Terakhir</th><th>Δ</th><th>Δ%</th><th>Volume</th></tr></thead>'
                f'<tbody>{body}</tbody></table>', unsafe_allow_html=True)


def news_card(item: dict) -> None:
    from datetime import datetime
    when = ""
    if item.get("ts"):
        try:
            when = datetime.fromtimestamp(item["ts"]).strftime("%d %b %H:%M")
        except Exception:
            when = ""
    sent = item.get("sentiment", "netral")
    st.markdown(
        f'<a class="news-item" href="{item.get("link", "#")}" target="_blank" rel="noopener">'
        f'<div class="news-title">{item["title"]}</div>'
        f'<div class="news-meta"><span>{item.get("source", "")}</span>'
        f'<span>{when}</span><span class="sent {sent}">{sent}</span></div></a>',
        unsafe_allow_html=True)


def signal_chips(sigs: list[dict]) -> None:
    cells = "".join(
        f'<div class="sigchip {s["dir"]}"><span class="s-name">{s["name"]}</span>'
        f'<span class="s-val">{s["value"]}</span>'
        f'<span class="muted" style="font-size:.72rem">{s["verdict"]}</span></div>'
        for s in sigs)
    st.markdown(f'<div style="display:flex;gap:10px;flex-wrap:wrap">{cells}</div>', unsafe_allow_html=True)


def verdict_badge(label: str, direction: str) -> None:
    st.markdown(f'<span class="vbadge {direction}">{label}</span>', unsafe_allow_html=True)


def trade_badge(side: str) -> str:
    cls = "badge-buy" if side.upper() == "BUY" else "badge-sell"
    return f'<span class="tbadge {cls}">{side.upper()}</span>'
