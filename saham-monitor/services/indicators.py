"""Indikator teknikal (SMA/EMA/RSI/MACD/Bollinger) + ringkasan sinyal."""
from __future__ import annotations

import pandas as pd
import ta

import config


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Tambahkan kolom indikator ke DataFrame OHLC."""
    out = df.copy()
    close = out["Close"]
    for p in config.SMA_PERIODS:
        out[f"SMA{p}"] = close.rolling(p).mean()
    out["EMA20"] = close.ewm(span=20, adjust=False).mean()
    try:
        out["RSI"] = ta.momentum.RSIIndicator(close, window=config.RSI_PERIOD).rsi()
        macd = ta.trend.MACD(close)
        out["MACD"] = macd.macd()
        out["MACD_signal"] = macd.macd_signal()
        out["MACD_hist"] = macd.macd_diff()
        bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
        out["BB_high"] = bb.bollinger_hband()
        out["BB_low"] = bb.bollinger_lband()
        out["BB_mid"] = bb.bollinger_mavg()
    except Exception:
        pass
    return out


def _val(row, key):
    v = row.get(key)
    return v if v is not None and v == v else None  # buang NaN


def signals(df: pd.DataFrame) -> list[dict]:
    """Ringkasan sinyal dari baris terakhir: [{name, value, verdict, dir}]."""
    if df is None or df.empty:
        return []
    last = df.iloc[-1]
    out = []

    rsi = _val(last, "RSI")
    if rsi is not None:
        if rsi >= 70:
            out.append({"name": "RSI (14)", "value": f"{rsi:.0f}", "verdict": "Overbought", "dir": "down"})
        elif rsi <= 30:
            out.append({"name": "RSI (14)", "value": f"{rsi:.0f}", "verdict": "Oversold", "dir": "up"})
        else:
            out.append({"name": "RSI (14)", "value": f"{rsi:.0f}", "verdict": "Netral", "dir": "flat"})

    close = _val(last, "Close")
    sma50 = _val(last, "SMA50")
    sma200 = _val(last, "SMA200")
    if close is not None and sma50 is not None:
        d = "up" if close >= sma50 else "down"
        out.append({"name": "Harga vs SMA50", "value": "di atas" if d == "up" else "di bawah",
                    "verdict": "Tren naik" if d == "up" else "Tren turun", "dir": d})
    if sma50 is not None and sma200 is not None:
        gc = sma50 >= sma200
        out.append({"name": "SMA50 vs SMA200", "value": "Golden" if gc else "Death",
                    "verdict": "Golden cross" if gc else "Death cross", "dir": "up" if gc else "down"})

    macd = _val(last, "MACD")
    sig = _val(last, "MACD_signal")
    if macd is not None and sig is not None:
        d = "up" if macd >= sig else "down"
        out.append({"name": "MACD", "value": "bullish" if d == "up" else "bearish",
                    "verdict": "MACD > signal" if d == "up" else "MACD < signal", "dir": d})
    return out


def verdict_overall(sigs: list[dict]) -> tuple[str, str]:
    """Skor agregat sinyal -> (label, dir)."""
    score = sum(1 if s["dir"] == "up" else -1 if s["dir"] == "down" else 0 for s in sigs)
    if score >= 2:
        return "BULLISH", "up"
    if score <= -2:
        return "BEARISH", "down"
    return "NETRAL", "flat"
