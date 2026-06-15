"""Berita & Sentimen — feed pasar umum + per-emiten, skor sentimen Bahasa Indonesia."""
from __future__ import annotations

import streamlit as st

import storage
import utils
from services import market_service as ms, news_service as ns
from ui.theme import news_card, section_header

st.title("Berita & Sentimen")

wl = storage.get_watchlist()
options = ["Pasar (umum)"] + [s for s in wl if not s.startswith("^")]

c1, c2 = st.columns([3, 1])
with c1:
    pick = st.selectbox("Sumber berita", options,
                        format_func=lambda s: s if s == "Pasar (umum)" else f"{utils.short_code(s)} · {utils.display_name(s)}")
with c2:
    st.write("")
    if st.button("Muat ulang", width="stretch"):
        st.cache_data.clear()
        st.rerun()

if pick == "Pasar (umum)":
    items = ns.fetch_general(limit=45)
    title = "Berita Pasar"
else:
    items = ns.fetch_for_query(f"{ms.get_name(pick)} saham", limit=30)
    title = f"Berita — {utils.short_code(pick)}"

roll = ns.sentiment_rollup(items)
m = st.columns(4)
m[0].metric("Total Berita", roll["total"])
m[1].metric("Positif", roll["pos"], delta=f'{(roll["pos"]/roll["total"]*100):.0f}%' if roll["total"] else None)
m[2].metric("Negatif", roll["neg"], delta=f'-{(roll["neg"]/roll["total"]*100):.0f}%' if roll["total"] else None)
m[3].metric("Netral", roll["net"])

# Bar sentimen ringkas
if roll["total"]:
    pos_w = roll["pos"] / roll["total"] * 100
    neg_w = roll["neg"] / roll["total"] * 100
    net_w = roll["net"] / roll["total"] * 100
    st.markdown(
        f'<div style="display:flex;height:8px;border-radius:999px;overflow:hidden;margin:4px 0 14px;border:1px solid var(--stroke)">'
        f'<div style="width:{pos_w}%;background:#0ecb81"></div>'
        f'<div style="width:{net_w}%;background:#7a869a"></div>'
        f'<div style="width:{neg_w}%;background:#f6465d"></div></div>', unsafe_allow_html=True)

section_header(title, meta=f"{len(items)} artikel")
if not items:
    st.info("Belum ada berita yang dapat dimuat. Coba 'Muat ulang' atau pilih sumber lain.")
for it in items:
    news_card(it)

st.caption("Sentimen dihitung dari judul memakai leksikon Bahasa Indonesia ringan (positif/negatif). "
           "Bukan rekomendasi investasi.")
