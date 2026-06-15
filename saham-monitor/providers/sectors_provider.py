"""Sectors.app — provider fundamental IDX (aktif bila ada SECTORS_KEY). EKSPERIMENTAL.

Terverifikasi via probe (Juni 2026): API v1 DIHENTIKAN 2026-05-11; v2 aktif di
base https://api.sectors.app/v2 dengan auth JWT (`Authorization: Bearer <token>`),
endpoint company report `/company/report/{ticker}/` (trailing slash wajib).
SECTORS_KEY = access token v2 dari dashboard sectors.app. Parser defensif.
Tanpa key / gagal -> fallback fundamental ke yfinance (sudah memadai).
"""
from __future__ import annotations

import requests

from models.fundamentals import Fundamentals
from providers.base import NETWORK, NO_DATA, Provider, ProviderResult
from providers.keys import get_key

_NUM = {
    "market_cap": ("market_cap", "marketcap"),
    "per": ("pe", "pe_ttm", "price_earnings", "per"),
    "pbv": ("pb", "pb_ttm", "price_book", "pbv"),
    "roe": ("roe", "return_on_equity"),
    "dividend_yield": ("dividend_yield", "yield"),
    "eps": ("eps", "eps_ttm"),
}
_STR = {
    "name": ("company_name", "name"),
    "sector": ("sector",),
    "industry": ("sub_sector", "industry"),
}


def _dig_num(obj, keys):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in keys and isinstance(v, (int, float)):
                return float(v)
        for v in obj.values():
            r = _dig_num(v, keys)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _dig_num(v, keys)
            if r is not None:
                return r
    return None


def _dig_str(obj, keys):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in keys and isinstance(v, str) and v:
                return v
        for v in obj.values():
            r = _dig_str(v, keys)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _dig_str(v, keys)
            if r:
                return r
    return None


class SectorsProvider(Provider):
    name = "sectors"
    asset_classes = ("equity",)
    BASE = "https://api.sectors.app/v2"

    def _key(self):
        return get_key("SECTORS_KEY")

    def supports(self, symbol: str) -> bool:
        return bool(self._key()) and symbol.endswith(".JK")

    def get_quote(self, symbol: str) -> ProviderResult:
        return ProviderResult.fail(NO_DATA, "quote via goapi/yfinance", self.name)

    def get_history(self, symbol, period="1y", interval="1d") -> ProviderResult:
        return ProviderResult.fail(NO_DATA, "history via yfinance", self.name)

    def get_fundamentals(self, symbol: str) -> ProviderResult:
        key = self._key()
        if not key:
            return ProviderResult.fail(NO_DATA, "SECTORS_KEY belum diatur", self.name)
        tkr = symbol.replace(".JK", "")
        try:
            r = requests.get(
                f"{self.BASE}/company/report/{tkr}/",
                params={"sections": "overview,valuation,financials,dividend"},
                headers={"Authorization": f"Bearer {key}"}, timeout=10)
            if r.status_code != 200:
                return ProviderResult.fail(NETWORK, f"HTTP {r.status_code}", self.name)
            d = r.json()
            f = Fundamentals(symbol=symbol, currency="IDR", source=self.name,
                             raw=d if isinstance(d, dict) else {})
            for attr, keys in _NUM.items():
                setattr(f, attr, _dig_num(d, keys))
            for attr, keys in _STR.items():
                setattr(f, attr, _dig_str(d, keys) or "")
            if not (f.name or f.market_cap or f.per):
                return ProviderResult.fail(NO_DATA, "data fundamental kosong", self.name)
            return ProviderResult.success(f, self.name)
        except Exception as e:  # noqa: BLE001
            return ProviderResult.fail(NETWORK, str(e), self.name)
