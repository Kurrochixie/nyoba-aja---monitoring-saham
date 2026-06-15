"""Helper kecil lintas-UI: normalisasi simbol, formatting angka (IDR/volume/%),
status jam bursa, dan helper warna naik/turun untuk pandas Styler.
"""
from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

import pandas as pd

import config
import storage

# Warna konsisten (selaras dengan tema TradingView)
UP = "#26a69a"
DOWN = "#ef5350"
FLAT = "#7a869a"


# ── Simbol ──────────────────────────────────────────────────────────────────
def normalize_symbol(raw: str) -> str:
    """'bbca' -> 'BBCA.JK', 'antm.jk' -> 'ANTM.JK', '^jkse' -> '^JKSE'.

    Simbol yang sudah punya '.' (mis. saham non-IDX 'AAPL') atau diawali '^'
    (index) dibiarkan apa adanya — hanya di-uppercase.
    """
    s = (raw or "").strip().upper()
    if not s:
        return s
    if s.startswith("^") or "." in s:
        return s
    return s + ".JK"


def display_name(symbol: str) -> str:
    """Nama tampilan murah (tanpa hit jaringan): KNOWN_NAMES -> meta DB -> kode."""
    if symbol in config.KNOWN_NAMES:
        return config.KNOWN_NAMES[symbol]
    meta = storage.get_meta_name(symbol)
    if meta:
        return meta
    return symbol.replace(".JK", "")


def short_code(symbol: str) -> str:
    return symbol.replace(".JK", "")


# ── Formatting ──────────────────────────────────────────────────────────────
def fmt_idr(v, *, prefix: bool = False) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "—"
    body = f"{int(round(v)):,}" if abs(v - round(v)) < 1e-9 else f"{v:,.2f}"
    return f"Rp{body}" if prefix else body


def fmt_pct(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    return f"{v:+.2f}%"


def fmt_big(v) -> str:
    """Angka besar -> 1.2T / 3.4M / 5.6K (untuk market cap & volume)."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "—"
    for div, suf in ((1e12, "T"), (1e9, "M"), (1e6, "Jt"), (1e3, "rb")):
        if abs(v) >= div:
            return f"{v / div:,.2f}{suf}"
    return f"{v:,.0f}"


def fmt_volume(v) -> str:
    return fmt_big(v)


# ── Warna untuk Styler ──────────────────────────────────────────────────────
def css_updown(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return f"color:{FLAT}"
    if v > 0:
        return f"color:{UP};font-weight:600"
    if v < 0:
        return f"color:{DOWN};font-weight:600"
    return f"color:{FLAT}"


# ── Jam bursa ───────────────────────────────────────────────────────────────
def is_market_open(now: datetime | None = None) -> bool:
    tz = ZoneInfo(config.MARKET_TZ)
    now = now.astimezone(tz) if now else datetime.now(tz)
    if now.weekday() >= 5:  # Sabtu/Minggu
        return False
    o = time(*config.MARKET_OPEN)
    c = time(*config.MARKET_CLOSE)
    return o <= now.time() <= c


def market_status() -> tuple[str, str]:
    return ("BUKA", "open") if is_market_open() else ("TUTUP", "closed")


def now_wib() -> datetime:
    return datetime.now(ZoneInfo(config.MARKET_TZ))


# ── TradingView & format Indonesia ──────────────────────────────────────────
def to_tv_symbol(sym: str) -> str:
    """Simbol yfinance -> TradingView. '^JKSE'->'IDX:COMPOSITE'; 'BBCA.JK'->'IDX:BBCA'."""
    if sym == "^JKSE":
        return "IDX:COMPOSITE"
    if sym.endswith(".JK"):
        return "IDX:" + sym[:-3]
    return sym


def fmt_id(x, dec: int = 2) -> str:
    """Format angka gaya Indonesia: ribuan=titik, desimal=koma -> '7.342,18'."""
    try:
        s = f"{float(x):,.{dec}f}"          # '7,342.18'
    except (TypeError, ValueError):
        return "—"
    return s.replace(",", "\0").replace(".", ",").replace("\0", ".")
