"""Portofolio & P/L — input transaksi, posisi, untung-rugi, alokasi, NAV."""
from __future__ import annotations

from datetime import date

import streamlit as st

import config
import storage
import utils
from services import market_service as ms, portfolio_service as ps
from ui import charts
from ui.theme import kpi_card, section_header, trade_badge

st.title("Portofolio")

wl_eq = [s for s in storage.get_watchlist() if not s.startswith("^")]

# ── Tambah transaksi ────────────────────────────────────────────────────────
section_header("Catat Transaksi")
with st.form("add_txn", clear_on_submit=True):
    c = st.columns([1.2, 1.6, 1, 1, 1.2, 1.2])
    d = c[0].date_input("Tanggal", value=date.today())
    sym_in = c[1].text_input("Kode", placeholder="BBCA / ANTM")
    ttype = c[2].selectbox("Tipe", ["BUY", "SELL"])
    lots = c[3].number_input("Lot", min_value=1, value=1, step=1)
    price = c[4].number_input("Harga/lembar", min_value=0.0, value=0.0, step=5.0)
    fee = c[5].number_input("Fee (Rp)", min_value=0.0, value=0.0, step=1000.0,
                            help="Kosongkan (0) untuk hitung otomatis")
    submitted = st.form_submit_button("Simpan transaksi", width="stretch")
if submitted:
    sym = utils.normalize_symbol(sym_in) if sym_in.strip() else (wl_eq[0] if wl_eq else "")
    if not sym or price <= 0:
        st.error("Isi kode emiten dan harga > 0.")
    else:
        value = lots * config.LOT_SIZE * price
        if fee <= 0:
            rate = config.DEFAULT_FEE_BUY if ttype == "BUY" else config.DEFAULT_FEE_SELL
            fee = round(value * rate)
        storage.add_transaction(d.isoformat(), sym, ttype, int(lots), price, fee)
        st.success(f"Tersimpan: {ttype} {lots} lot {utils.short_code(sym)} @ {utils.fmt_idr(price)} (fee {utils.fmt_idr(fee)})")
        st.rerun()

positions, tot = ps.build_positions()

if not positions and not storage.get_transactions():
    st.info("Belum ada transaksi. Catat pembelian pertama Anda di atas.")
    st.stop()

# ── KPI ─────────────────────────────────────────────────────────────────────
section_header("Ikhtisar Portofolio")
k = st.columns(4)
with k[0]:
    kpi_card("Nilai Pasar", utils.fmt_idr(tot["market"]), tot["day"],
             (tot["day"] / (tot["market"] - tot["day"]) * 100) if (tot["market"] - tot["day"]) else 0.0,
             "HARI INI")
with k[1]:
    kpi_card("Total Modal", utils.fmt_idr(tot["cost"]), code="COST")
with k[2]:
    kpi_card("P/L Belum Terealisasi", utils.fmt_idr(tot["unrealized"]),
             tot["unrealized"], tot["total_pl_pct"], "UNREALIZED")
with k[3]:
    kpi_card("P/L Terealisasi", utils.fmt_idr(tot["realized"]),
             tot["realized"], 0.0, "REALIZED")

# ── Tabel posisi ────────────────────────────────────────────────────────────
section_header("Posisi Terbuka", meta=f"{len(positions)} emiten")


def _pos_table(rows: list[dict]) -> None:
    def cls(v):
        return "up" if v > 0 else "down" if v < 0 else "flat"
    body = ""
    for p in rows:
        c = cls(p["unrealized"])
        body += (f'<tr><td class="c-code">{utils.short_code(p["symbol"])}</td>'
                 f'<td class="c-name">{utils.display_name(p["symbol"])}</td>'
                 f'<td>{p["lots"]}</td>'
                 f'<td>{utils.fmt_idr(p["avg"])}</td>'
                 f'<td>{utils.fmt_idr(p["last"])}</td>'
                 f'<td>{utils.fmt_idr(p["market"])}</td>'
                 f'<td class="{c}">{utils.fmt_idr(p["unrealized"])}</td>'
                 f'<td class="{c}">{p["unrealized_pct"]:+.2f}%</td>'
                 f'<td class="muted">{p["weight"]:.1f}%</td></tr>')
    st.markdown(
        '<table class="wl"><thead><tr><th>Kode</th><th>Nama</th><th>Lot</th><th>Avg</th>'
        '<th>Terakhir</th><th>Nilai</th><th>P/L</th><th>P/L%</th><th>Bobot</th></tr></thead>'
        f'<tbody>{body}</tbody></table>', unsafe_allow_html=True)


if positions:
    _pos_table(positions)

    cc = st.columns([1, 1])
    with cc[0]:
        section_header("Alokasi")
        st.plotly_chart(
            charts.donut([utils.short_code(p["symbol"]) for p in positions],
                         [p["market"] for p in positions]),
            width="stretch", config={"displayModeBar": False})
    with cc[1]:
        section_header("Pertumbuhan Nilai (NAV)")
        nav = ps.nav_series(period="1y")
        if nav is not None:
            st.plotly_chart(charts.nav_line(nav), width="stretch",
                            config={"displayModeBar": False})
            mt = ps.metrics_from_nav(nav)
            if mt:
                m = st.columns(3)
                m[0].metric("Return", f"{mt['total_return']:+.2f}%")
                m[1].metric("Max Drawdown", f"{mt['max_drawdown']:.2f}%")
                m[2].metric("Sharpe", f"{mt['sharpe']:.2f}")
        else:
            st.caption("NAV historis belum cukup data untuk digambar.")
else:
    st.info("Semua posisi sudah terjual. Lihat riwayat & P/L terealisasi di bawah.")

# ── Riwayat transaksi ───────────────────────────────────────────────────────
section_header("Riwayat Transaksi")
txns = storage.get_transactions()
for t in reversed(txns):
    cols = st.columns([1.3, 1, 0.8, 0.7, 1.3, 1.2, 0.5])
    cols[0].write(t["date"])
    cols[1].write(f"**{utils.short_code(t['symbol'])}**")
    cols[2].markdown(trade_badge(t["type"]), unsafe_allow_html=True)
    cols[3].write(f"{t['lots']} lot")
    cols[4].write(utils.fmt_idr(t["price"]))
    cols[5].write(f"fee {utils.fmt_idr(t['fee'])}")
    if cols[6].button("Hapus", key=f"deltxn_{t['id']}", help="Hapus transaksi"):
        storage.delete_transaction(t["id"])
        st.rerun()
