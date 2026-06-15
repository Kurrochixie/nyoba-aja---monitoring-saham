"""Pengaturan — watchlist, koneksi data realtime & notifikasi, info."""
from __future__ import annotations

import streamlit as st

import config
import storage
import utils
from services import alert_service as als, market_service as ms
from ui.theme import section_header

st.title("Pengaturan")

# ── Watchlist ───────────────────────────────────────────────────────────────
section_header("Kelola Watchlist")
with st.form("add_symbol", clear_on_submit=True):
    c1, c2 = st.columns([3, 1])
    raw = c1.text_input("Tambah instrumen", placeholder="mis. BBCA, ANTM.JK, atau ^JKSE",
                        label_visibility="collapsed")
    add = c2.form_submit_button("Tambah", width="stretch")
if add and raw.strip():
    sym = utils.normalize_symbol(raw)
    if storage.in_watchlist(sym):
        st.warning(f"{sym} sudah ada di watchlist.")
    else:
        with st.spinner(f"Memeriksa {sym}…"):
            q = ms.get_quote_obj(sym)
        if q is None:
            st.error(f"'{sym}' tidak ditemukan / tidak ada data. Periksa kembali kodenya.")
        else:
            storage.add_to_watchlist(sym)
            st.success(f"Ditambahkan: {sym} — {ms.get_name(sym)}")
            st.rerun()

wl = storage.get_watchlist()
st.caption(f"{len(wl)} instrumen dalam watchlist")
for s in wl:
    c1, c2, c3 = st.columns([2, 5, 1])
    c1.markdown(f"**{utils.short_code(s)}**")
    c2.write(utils.display_name(s))
    if c3.button("Hapus", key=f"del_{s}", help=f"Hapus {s}"):
        storage.remove_from_watchlist(s)
        st.rerun()

# ── Koneksi data & notifikasi ───────────────────────────────────────────────
section_header("Koneksi Data Realtime & Notifikasi")
st.caption("Opsional. Tanpa key, app pakai yfinance (delayed ~15–20 mnt). "
           "Isi key untuk mengaktifkan harga realtime / fundamental akurat / notifikasi Telegram. "
           "Key disimpan lokal di database Anda.")

st.markdown("**Sumber aktif saat ini:** " + " · ".join(ms.active_sources()))

with st.form("keys"):
    cols = st.columns(2)
    goapi = cols[0].text_input("GOAPI_KEY (harga realtime IDX)", type="password",
                               value=storage.kv_get("GOAPI_KEY", "") or "",
                               help="Daftar di goapi.io → app.goapi.io, buat Stock API key (ada tier gratis)")
    sectors = cols[1].text_input("SECTORS_KEY (fundamental v2 — eksperimental)", type="password",
                                 value=storage.kv_get("SECTORS_KEY", "") or "",
                                 help="Access token Sectors.app v2 (opsional; fundamental sudah dicover yfinance)")
    tg_tok = cols[0].text_input("TG_TOKEN (Telegram bot)", type="password",
                                value=storage.kv_get("TG_TOKEN", "") or "")
    tg_chat = cols[1].text_input("TG_CHAT_ID (Telegram chat)", type="password",
                                 value=storage.kv_get("TG_CHAT_ID", "") or "")
    if st.form_submit_button("Simpan key", width="stretch"):
        for k, v in (("GOAPI_KEY", goapi), ("SECTORS_KEY", sectors),
                     ("TG_TOKEN", tg_tok), ("TG_CHAT_ID", tg_chat)):
            storage.kv_set(k, v.strip())
        st.cache_data.clear()
        st.success("Key tersimpan. Sumber data diperbarui.")
        st.rerun()

if als.telegram_ready():
    if st.button("Tes kirim Telegram"):
        ok = als.send_telegram("Tes notifikasi dari Saham Monitor")
        st.success("Terkirim!") if ok else st.error("Gagal mengirim. Periksa token/chat id.")

# ── Info & pemeliharaan ─────────────────────────────────────────────────────
section_header("Info & Pemeliharaan")
rt = "REALTIME (GoAPI)" if ms.is_realtime() else "DELAYED (yfinance ~10–20 mnt)"
st.markdown(
    f"""
- **Status harga:** {rt}
- **TTL cache:** quote {config.TTL_QUOTE}s · history {config.TTL_HISTORY}s · berita {config.TTL_NEWS}s
- **Mata uang:** {config.CURRENCY} · 1 lot IDX = {config.LOT_SIZE} lembar · fee beli {config.DEFAULT_FEE_BUY*100:.2f}% / jual {config.DEFAULT_FEE_SELL*100:.2f}%
- **Database:** `{config.DB_PATH}`
- **Alert 24/7:** jalankan `python alerts_daemon.py` (background) untuk cek alert tanpa app terbuka.
"""
)
if st.button("Bersihkan cache data"):
    st.cache_data.clear()
    st.success("Cache dibersihkan — data diambil ulang saat berikutnya dibuka.")
