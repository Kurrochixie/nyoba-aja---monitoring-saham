"""Saham Monitor — entrypoint.

Jalankan dengan:  streamlit run app.py
File ini bertindak sebagai 'router/frame': set page config, inject tema, branding
sidebar, lalu serahkan ke halaman aktif via st.navigation (cara multipage modern).
"""
from __future__ import annotations

import streamlit as st

from ui.theme import inject_theme

st.set_page_config(
    page_title="Saham Monitor",
    page_icon=":material/monitoring:",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_theme()

with st.sidebar:
    st.markdown(
        '<div class="brand"><span class="ms">monitoring</span> Saham <span class="accent">Monitor</span></div>',
        unsafe_allow_html=True,
    )
    st.caption("Personal IHSG terminal")
    st.divider()

# Definisi halaman (st.Page) + navigasi berkelompok.
dashboard = st.Page("views/dashboard.py", title="Dashboard", default=True)
research = st.Page("views/research.py", title="Riset Saham")
portfolio = st.Page("views/portfolio.py", title="Portofolio")
alerts = st.Page("views/alerts.py", title="Alert")
news = st.Page("views/news.py", title="Berita")
settings = st.Page("views/settings.py", title="Pengaturan")

nav = st.navigation([dashboard, research, portfolio, alerts, news, settings])
nav.run()
