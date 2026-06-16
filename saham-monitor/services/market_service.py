"""Service pasar: bungkus provider dengan cache + fallback chain antar-sumber.

UI memanggil fungsi di sini, BUKAN provider/registry langsung.
"""
from __future__ import annotations

import streamlit as st

import config
import storage
from models.quote import Quote
from providers import registry
from providers.keys import get_key


# ── Quote (fallback: goapi -> ... -> yfinance) ──────────────────────────────
@st.cache_data(ttl=config.TTL_QUOTE, show_spinner=False)
def _quote_cached(symbol: str):
    for p in registry.providers():
        if not p.supports(symbol):
            continue
        res = p.get_quote(symbol)
        if res.ok and res.data is not None:
            return res.data
    return None


_last_quote_source = None


def get_quote_obj(symbol: str) -> Quote | None:
    q = _quote_cached(symbol)
    if q is not None and getattr(q, "source", None):
        global _last_quote_source
        _last_quote_source = q.source
    return q


def get_quotes(symbols: list[str]) -> dict[str, Quote | None]:
    return {s: get_quote_obj(s) for s in symbols}


# ── History (harian) & intraday ─────────────────────────────────────────────
@st.cache_data(ttl=config.TTL_HISTORY, show_spinner=False)
def _history_cached(symbol: str, period: str, interval: str):
    for p in registry.providers():
        if not p.supports(symbol):
            continue
        res = p.get_history(symbol, period=period, interval=interval)
        if res.ok and res.data is not None and not res.data.empty:
            return res.data, ""
    return None, "tidak ada data riwayat"


def get_history(symbol: str, period: str = "1y", interval: str = "1d"):
    return _history_cached(symbol, period, interval)


@st.cache_data(ttl=config.TTL_INTRADAY, show_spinner=False)
def get_intraday(symbol: str, period: str = "1d", interval: str = "5m"):
    df, err = _history_cached(symbol, period, interval)
    return df, err


# ── Fundamentals (sectors -> yfinance) ──────────────────────────────────────
@st.cache_data(ttl=config.TTL_FUNDAMENTALS, show_spinner=False)
def get_fundamentals(symbol: str):
    for p in registry.providers():
        if not p.supports(symbol):
            continue
        res = p.get_fundamentals(symbol)
        if res.ok and res.data is not None:
            return res.data
    return None


# ── Nama emiten (best-effort, cache harian) ─────────────────────────────────
@st.cache_data(ttl=config.TTL_NAME, show_spinner=False)
def get_name(symbol: str) -> str:
    if symbol in config.KNOWN_NAMES:
        return config.KNOWN_NAMES[symbol]
    cached = storage.get_meta_name(symbol)
    if cached:
        return cached
    f = get_fundamentals(symbol)
    if f and f.name:
        storage.upsert_meta(symbol, name=f.name, currency=f.currency, sector=f.sector)
        return f.name
    return symbol.replace(".JK", "")


# ── Label sumber data (untuk status bar / Pengaturan) ───────────────────────
def is_realtime() -> bool:
    # realtime HANYA bila quote terakhir benar-benar dari GoAPI (bukan fallback yfinance delayed)
    return bool(get_key("GOAPI_KEY")) and _last_quote_source == "goapi"


def primary_source_label() -> str:
    if get_key("GOAPI_KEY"):
        return "GoAPI · realtime"
    return "yfinance · delayed ~15–20 mnt"


def active_sources() -> list[str]:
    out = []
    if get_key("GOAPI_KEY"):
        out.append("GoAPI (quote realtime)")
    if get_key("SECTORS_KEY"):
        out.append("Sectors.app (fundamental)")
    out.append("yfinance (harga delayed + history)")
    return out
