"""Skema ternormalisasi: bentuk umum data agar UI tidak peduli sumber asalnya."""
from __future__ import annotations

import pandas as pd

# Kolom standar DataFrame history
HIST_COLS = ["Open", "High", "Low", "Close", "Volume"]


def normalize_history(df: pd.DataFrame) -> pd.DataFrame:
    """Pastikan DataFrame history punya kolom Title-case standar + index 'Date'.

    yfinance kadang mengembalikan kolom seperti 'Adj Close' atau lowercase;
    kita seragamkan ke HIST_COLS.
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=HIST_COLS)
    out = df.rename(columns=lambda c: str(c).strip().title())
    cols = [c for c in HIST_COLS if c in out.columns]
    out = out[cols].copy()
    out.index.name = "Date"
    return out
