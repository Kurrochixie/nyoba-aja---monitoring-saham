"""Halaman Dashboard — ticker tape, KPI cards, watchlist premium, chart TradingView."""
from __future__ import annotations

import streamlit as st

import config
import storage
import utils
from services import alert_service as als, market_service as ms
from ui import charts
from ui.theme import kpi_card, section_header, status_bar, ticker_tape, watchlist_table

# ── Kontrol tampilan (sidebar) ──────────────────────────────────────────────
with st.sidebar:
    st.subheader("Tampilan")
    auto = st.toggle("Auto-refresh harga", value=False,
                     help="Perbarui otomatis selama dashboard terbuka")
    interval = st.select_slider("Interval", options=[15, 30, 60], value=30,
                                format_func=lambda x: f"{x} detik", disabled=not auto)
run_every = interval if auto else None

symbols = storage.get_watchlist()
if not symbols:
    st.title("Dashboard Pasar")
    st.info("Watchlist masih kosong. Tambahkan saham di halaman **Pengaturan**.")
    st.stop()

idx_syms = [s for s in symbols if s.startswith("^")]
eq_syms = [s for s in symbols if not s.startswith("^")]

# Ticker tape berjalan (custom HTML pakai data lokal — andal, di luar fragment)
_tq = ms.get_quotes(symbols)
ticker_tape([{"sym": "IHSG" if s == "^JKSE" else utils.short_code(s),
              "price": utils.fmt_idr(q.price), "pct": q.change_pct}
             for s in symbols if (q := _tq.get(s))])

st.title("Dashboard Pasar")


@st.fragment(run_every=run_every)
def live_section() -> None:
    """Bagian 'live': status, KPI, watchlist. Hanya HTML/komponen — aman di fragment."""
    quotes = ms.get_quotes(symbols)
    status_bar(utils.is_market_open(), f"{utils.now_wib():%H:%M:%S}", source=ms.primary_source_label())

    # Evaluasi alert otomatis selama dashboard terbuka (edge-trigger + cooldown)
    try:
        for fired in als.evaluate(quotes):
            st.toast(fired["detail"])
    except Exception:
        pass

    # Ringkasan: IHSG + 3 penggerak terbesar (abs %)
    section_header("Ringkasan Pasar")
    cards = [(s, quotes.get(s)) for s in idx_syms[:1]]
    movers = sorted([s for s in eq_syms if quotes.get(s)],
                    key=lambda s: abs(quotes[s].change_pct), reverse=True)[:3]
    cards += [(s, quotes.get(s)) for s in movers]
    if cards:
        cols = st.columns(len(cards))
        for col, (s, q) in zip(cols, cards):
            with col:
                if q:
                    kpi_card(utils.display_name(s), utils.fmt_idr(q.price),
                             q.change, q.change_pct, utils.short_code(s))
                else:
                    kpi_card(utils.display_name(s), "—", code=utils.short_code(s))

    # Watchlist premium (HTML + sparkline tren 30 hari)
    section_header("Watchlist", meta=f"{len(eq_syms)} saham")
    rows = []
    for s in eq_syms:
        q = quotes.get(s)
        hist, _ = ms.get_history(s, period="1mo")
        closes = hist["Close"].tolist() if hist is not None and not hist.empty else []
        rows.append({
            "code": utils.short_code(s),
            "name": utils.display_name(s),
            "spark": charts.sparkline_svg(closes[-30:]) if closes else "",
            "last": utils.fmt_idr(q.price) if q else "—",
            "chg": f"{q.change:+,.0f}" if q else "—",
            "pct": q.change_pct if q else 0.0,
            "vol": utils.fmt_volume(q.volume) if q else "—",
        })
    watchlist_table(rows)


live_section()

# ── Detail instrumen + chart ────────────────────────────────────────────────
st.divider()
section_header("Detail Instrumen")

c1, c2, c3 = st.columns([2, 2, 2])
with c1:
    sel = st.selectbox("Pilih instrumen", symbols,
                       format_func=lambda s: f"{utils.short_code(s)} · {utils.display_name(s)}")
with c2:
    src = st.segmented_control("Sumber chart", ["Plotly (lokal)", "TradingView"],
                               default="Plotly (lokal)", selection_mode="single")
with c3:
    period_lbl = st.segmented_control("Periode (Plotly)", list(config.PERIODS.keys()),
                                      default="1T", selection_mode="single")
period = config.PERIODS.get(period_lbl or "1T", "1y")

# Best-effort: isi nama emiten (non-index) agar tabel watchlist ikut terisi.
if sel and not sel.startswith("^"):
    ms.get_name(sel)

q = ms.get_quote_obj(sel)
if q:
    m = st.columns(4)
    m[0].metric("Terakhir", utils.fmt_idr(q.price),
                f"{q.change:+,.2f} ({q.change_pct:+.2f}%)")
    m[1].metric("Tertinggi", utils.fmt_idr(q.day_high))
    m[2].metric("Terendah", utils.fmt_idr(q.day_low))
    m[3].metric("Volume", utils.fmt_volume(q.volume))

if (src or "Plotly (lokal)") == "TradingView":
    charts.tv_advanced_chart(sel, height=520)
else:
    hist, err = ms.get_history(sel, period=period)
    if hist is not None and not hist.empty:
        st.plotly_chart(charts.candlestick(hist, show_volume=not sel.startswith("^")),
                        width="stretch", config={"displayModeBar": False})
    else:
        st.warning(f"Gagal memuat grafik {sel}: {err or 'tidak ada data'}")
