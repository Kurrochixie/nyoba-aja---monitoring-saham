from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Quote:
    """Snapshot harga ternormalisasi (sumber-agnostik)."""
    symbol: str
    price: float = 0.0
    previous_close: float = 0.0
    open: float = 0.0
    day_high: float = 0.0
    day_low: float = 0.0
    volume: float = 0.0
    currency: str = "IDR"
    market_cap: float | None = None
    source: str = ""

    @property
    def change(self) -> float:
        return self.price - self.previous_close if self.previous_close else 0.0

    @property
    def change_pct(self) -> float:
        return (self.change / self.previous_close * 100.0) if self.previous_close else 0.0
