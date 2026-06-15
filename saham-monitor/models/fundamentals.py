from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Fundamentals:
    """Data fundamental ternormalisasi (sebagian field bisa None)."""
    symbol: str
    name: str = ""
    sector: str = ""
    industry: str = ""
    market_cap: float | None = None
    per: float | None = None            # trailing P/E
    pbv: float | None = None            # price-to-book
    eps: float | None = None
    book_value: float | None = None
    dividend_yield: float | None = None  # fraksi (cek per-sumber)
    roe: float | None = None
    de_ratio: float | None = None
    profit_margin: float | None = None
    week52_high: float | None = None
    week52_low: float | None = None
    beta: float | None = None
    currency: str = "IDR"
    source: str = ""
    raw: dict = field(default_factory=dict)
