"""Alert & Notifikasi — buat rule, cek, kelola, riwayat. Edge-trigger + cooldown."""
from __future__ import annotations

from datetime import datetime

import streamlit as st

import storage
import utils
from services import alert_service as als, market_service as ms
from ui.theme import icon, section_header

st.title("Alert & Notifikasi")

symbols = storage.get_watchlist()

# ── Buat rule ───────────────────────────────────────────────────────────────
section_header("Buat Alert Baru")
with st.form("add_rule", clear_on_submit=True):
    c = st.columns([1.6, 1.3, 0.8, 1.1, 1.0])
    sym = c[0].selectbox("Instrumen", symbols,
                         format_func=lambda s: f"{utils.short_code(s)} · {utils.display_name(s)}")
    metric_lbl = c[1].selectbox("Metrik", ["Harga (Rp)", "Perubahan harian (%)"])
    op = c[2].selectbox("Kondisi", als.OPS)
    value = c[3].number_input("Nilai", value=0.0, step=10.0)
    cooldown = c[4].number_input("Cooldown (mnt)", min_value=0, value=30, step=5)
    channels = st.multiselect("Kirim ke", ["app", "telegram", "desktop"], default=["app"],
                              help="app = notifikasi dalam aplikasi · telegram & desktop perlu konfigurasi")
    submitted = st.form_submit_button("Simpan alert", width="stretch")
if submitted:
    metric = "price" if metric_lbl.startswith("Harga") else "change_pct"
    q = ms.get_quote_obj(sym)
    cur = (q.price if metric == "price" else q.change_pct) if q else None
    name = f"{utils.short_code(sym)} {metric_lbl} {op} {value}"
    storage.add_rule(name, sym, metric, op, value, int(cooldown), "+".join(channels) or "app")
    extra = f" (saat ini {cur:,.2f})" if cur is not None else ""
    st.success(f"Alert dibuat: {name}{extra}")
    st.rerun()

# ── Cek sekarang ────────────────────────────────────────────────────────────
cc = st.columns([1, 3])
if cc[0].button("Cek alert sekarang", width="stretch"):
    fired = als.evaluate()
    if fired:
        for f in fired:
            st.toast(f["detail"])
        st.success(f"{len(fired)} alert terpicu.")
    else:
        st.info("Tidak ada alert yang terpicu saat ini.")
cc[1].caption("Tip: aktifkan **Auto-refresh** di Dashboard agar alert dicek otomatis selama app terbuka. "
              "Untuk pemantauan 24/7 tanpa app terbuka, jalankan `alerts_daemon.py`.")

# ── Daftar rule ─────────────────────────────────────────────────────────────
section_header("Alert Aktif", meta=f"{len(storage.get_rules())} total")
rules = storage.get_rules()
if not rules:
    st.caption("Belum ada alert.")
for r in rules:
    col = st.columns([0.6, 3, 1.2, 1, 0.6])
    on = col[0].toggle("", value=bool(r["active"]), key=f"tg_{r['id']}", label_visibility="collapsed")
    if on != bool(r["active"]):
        storage.toggle_rule(r["id"], on)
        st.rerun()
    col[1].markdown(f"**{utils.short_code(r['symbol'])}** · {als.METRICS.get(r['metric'], r['metric'])} "
                    f"`{r['op']}` **{r['value']:,.2f}**")
    col[2].caption(f"Kanal: {r['channel']}")
    col[3].caption(f"Cooldown: {r['cooldown_min']}m")
    if col[4].button("Hapus", key=f"delrule_{r['id']}"):
        storage.delete_rule(r["id"])
        st.rerun()

# ── Riwayat ─────────────────────────────────────────────────────────────────
section_header("Riwayat Pemicu")
events = storage.get_alert_events(30)
if not events:
    st.caption("Belum ada alert yang terpicu.")
for e in events:
    when = ""
    try:
        when = datetime.fromisoformat(e["fired_at"]).strftime("%d %b %H:%M")
    except Exception:
        pass
    st.markdown(f'<div class="news-item"><div class="news-title">{icon("notifications")} {e["detail"]}</div>'
                f'<div class="news-meta"><span>{when}</span></div></div>', unsafe_allow_html=True)

# ── Status kanal ────────────────────────────────────────────────────────────
section_header("Status Kanal Notifikasi")
tg = "aktif" if als.telegram_ready() else "belum dikonfigurasi (set TG_TOKEN & TG_CHAT_ID di Pengaturan)"
st.markdown(f"- **In-app (toast):** aktif saat app terbuka\n"
            f"- **Telegram:** {tg}\n"
            f"- **Desktop:** via `plyer` (saat daemon/app berjalan di mesin Anda)")
