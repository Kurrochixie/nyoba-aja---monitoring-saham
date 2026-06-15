"""Riset Saham — Ringkasan, Fundamental, Analisis Teknikal, Berita per emiten."""
from __future__ import annotations

import streamlit as st

import config
import storage
import utils
from services import indicators, market_service as ms, news_service as ns
from ui import charts
from ui.theme import news_card, section_header, signal_chips, verdict_badge

st.title("Riset Saham")

wl = [s for s in storage.get_watchlist() if not s.startswith("^")] or ["BBCA.JK"]
c1, c2 = st.columns([3, 2])
with c1:
    sel = st.selectbox("Pilih emiten", wl,
                       format_func=lambda s: f"{utils.short_code(s)} · {utils.display_name(s)}")
with c2:
    typed = st.text_input("atau ketik kode lain", placeholder="mis. UNVR / GGRM")
if typed.strip():
    sel = utils.normalize_symbol(typed)

name = ms.get_name(sel)
q = ms.get_quote_obj(sel)
fund = ms.get_fundamentals(sel)

st.markdown(f"### {utils.short_code(sel)} — {name}")


def _pct(v, scale=True):
    if v is None:
        return "—"
    v = float(v)
    if scale and abs(v) <= 1.5:
        v *= 100
    return f"{v:.2f}%"


tab_sum, tab_fund, tab_tech, tab_news = st.tabs(
    ["Ringkasan", "Fundamental", "Analisis Teknikal", "Berita"])

# ── Ringkasan ───────────────────────────────────────────────────────────────
with tab_sum:
    if q:
        m = st.columns(4)
        m[0].metric("Harga", utils.fmt_idr(q.price), f"{q.change:+,.2f} ({q.change_pct:+.2f}%)")
        m[1].metric("Tertinggi", utils.fmt_idr(q.day_high))
        m[2].metric("Terendah", utils.fmt_idr(q.day_low))
        m[3].metric("Volume", utils.fmt_volume(q.volume))
    if fund:
        m = st.columns(4)
        m[0].metric("Kapitalisasi", utils.fmt_big(fund.market_cap))
        m[1].metric("PER", f"{fund.per:.2f}x" if fund.per else "—")
        m[2].metric("PBV", f"{fund.pbv:.2f}x" if fund.pbv else "—")
        m[3].metric("Dividend Yield", _pct(fund.dividend_yield))
        if fund.week52_low and fund.week52_high:
            st.caption(f"Rentang 52 minggu: {utils.fmt_idr(fund.week52_low)} – "
                       f"{utils.fmt_idr(fund.week52_high)} · Sektor: {fund.sector or '—'}")
    else:
        st.info("Data fundamental belum tersedia untuk emiten ini.")

# ── Fundamental ─────────────────────────────────────────────────────────────
with tab_fund:
    if fund:
        rows = [
            ("Sektor", fund.sector or "—"), ("Industri", fund.industry or "—"),
            ("Kapitalisasi Pasar", utils.fmt_idr(fund.market_cap) if fund.market_cap else "—"),
            ("PER (trailing)", f"{fund.per:.2f}x" if fund.per else "—"),
            ("PBV", f"{fund.pbv:.2f}x" if fund.pbv else "—"),
            ("EPS", utils.fmt_idr(fund.eps) if fund.eps else "—"),
            ("Book Value/Share", utils.fmt_idr(fund.book_value) if fund.book_value else "—"),
            ("Dividend Yield", _pct(fund.dividend_yield)),
            ("ROE", _pct(fund.roe)),
            ("Net Profit Margin", _pct(fund.profit_margin)),
            ("Debt to Equity", f"{fund.de_ratio:.2f}" if fund.de_ratio else "—"),
            ("Beta", f"{fund.beta:.2f}" if fund.beta else "—"),
        ]
        import pandas as pd
        df = pd.DataFrame(rows, columns=["Metrik", "Nilai"])
        st.dataframe(df, width="stretch", hide_index=True)
        st.caption(f"Sumber fundamental: {fund.source}")
    else:
        st.info("Data fundamental belum tersedia.")

# ── Analisis Teknikal ───────────────────────────────────────────────────────
with tab_tech:
    period_lbl = st.segmented_control("Periode", list(config.PERIODS.keys()),
                                      default="1T", selection_mode="single")
    period = config.PERIODS.get(period_lbl or "1T", "1y")
    hist, err = ms.get_history(sel, period=period)
    if hist is not None and not hist.empty:
        enr = indicators.enrich(hist)
        sigs = indicators.signals(enr)
        label, direction = indicators.verdict_overall(sigs)
        cc1, cc2 = st.columns([1, 3])
        with cc1:
            st.markdown("**Sinyal Agregat**")
            verdict_badge(label, direction)
        with cc2:
            if sigs:
                signal_chips(sigs)
        st.plotly_chart(charts.tech_chart(enr), width="stretch",
                        config={"displayModeBar": False})
    else:
        st.warning(f"Gagal memuat data teknikal: {err}")

# ── Berita ──────────────────────────────────────────────────────────────────
with tab_news:
    query = f"{name} saham"
    items = ns.fetch_for_query(query, limit=20)
    roll = ns.sentiment_rollup(items)
    if items:
        m = st.columns(4)
        m[0].metric("Berita", roll["total"])
        m[1].metric("Positif", roll["pos"])
        m[2].metric("Negatif", roll["neg"])
        m[3].metric("Netral", roll["net"])
        section_header("Berita Terkait")
        for it in items:
            news_card(it)
    else:
        st.info("Belum ada berita yang ditemukan untuk emiten ini.")
