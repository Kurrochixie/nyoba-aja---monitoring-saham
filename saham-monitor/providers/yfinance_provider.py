"""Provider yfinance — sumber gratis utama untuk IHSG/IDX (.JK) & index (^JKSE).

Catatan: yfinance memberi data DELAYED (~15-20 menit) dan API-nya tidak resmi,
jadi semua akses dibungkus try/except dan mengembalikan ProviderResult.
"""
from __future__ import annotations

import logging

import yfinance as yf

from models.fundamentals import Fundamentals
from models.quote import Quote
from providers.base import NETWORK, NO_DATA, Provider, ProviderResult
from providers.schema import normalize_history

# yfinance suka mencetak progress/warning ke stdout/stderr — bungkam.
logging.getLogger("yfinance").setLevel(logging.CRITICAL)


def _g(fi, attr, default=None):
    """Ambil atribut FastInfo dengan aman (dukung akses atribut & dict)."""
    try:
        v = getattr(fi, attr)
        if v is not None:
            return v
    except Exception:
        pass
    try:
        return fi[attr]
    except Exception:
        return default


def _num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


class YFinanceProvider(Provider):
    name = "yfinance"
    asset_classes = ("equity", "index", "etf")

    def supports(self, symbol: str) -> bool:
        # Catch-all: yfinance menangani hampir semua simbol global.
        return True

    def get_quote(self, symbol: str) -> ProviderResult:
        try:
            fi = yf.Ticker(symbol).fast_info
            price = _g(fi, "last_price")
            if price is None:
                return ProviderResult.fail(NO_DATA, f"tidak ada harga untuk {symbol}", self.name)
            q = Quote(
                symbol=symbol,
                price=_num(price),
                previous_close=_num(_g(fi, "previous_close")),
                open=_num(_g(fi, "open")),
                day_high=_num(_g(fi, "day_high")),
                day_low=_num(_g(fi, "day_low")),
                volume=_num(_g(fi, "last_volume")),
                currency=str(_g(fi, "currency", "IDR") or "IDR"),
                market_cap=_g(fi, "market_cap"),
                source=self.name,
            )
            return ProviderResult.success(q, self.name)
        except Exception as e:  # noqa: BLE001 — API tidak resmi, tangkap semua
            return ProviderResult.fail(NETWORK, str(e), self.name)

    def get_history(self, symbol: str, period: str = "1y",
                    interval: str = "1d") -> ProviderResult:
        try:
            df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
            if df is None or df.empty:
                return ProviderResult.fail(NO_DATA, f"tidak ada riwayat untuk {symbol}", self.name)
            return ProviderResult.success(normalize_history(df), self.name)
        except Exception as e:  # noqa: BLE001
            return ProviderResult.fail(NETWORK, str(e), self.name)

    def get_fundamentals(self, symbol: str) -> ProviderResult:
        try:
            info = yf.Ticker(symbol).info or {}
            if not info or len(info) < 3:
                return ProviderResult.fail(NO_DATA, f"tidak ada fundamental untuk {symbol}", self.name)
            f = Fundamentals(
                symbol=symbol,
                name=info.get("longName") or info.get("shortName") or "",
                sector=info.get("sector") or "",
                industry=info.get("industry") or "",
                market_cap=info.get("marketCap"),
                per=info.get("trailingPE"),
                pbv=info.get("priceToBook"),
                eps=info.get("trailingEps"),
                book_value=info.get("bookValue"),
                dividend_yield=info.get("dividendYield"),
                roe=info.get("returnOnEquity"),
                de_ratio=info.get("debtToEquity"),
                profit_margin=info.get("profitMargins"),
                week52_high=info.get("fiftyTwoWeekHigh"),
                week52_low=info.get("fiftyTwoWeekLow"),
                beta=info.get("beta"),
                currency=info.get("currency") or "IDR",
                source=self.name,
                raw=info,
            )
            return ProviderResult.success(f, self.name)
        except Exception as e:  # noqa: BLE001
            return ProviderResult.fail(NETWORK, str(e), self.name)
