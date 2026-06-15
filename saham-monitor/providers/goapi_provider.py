"""GoAPI.io — provider quote REALTIME IDX (aktif bila ada GOAPI_KEY).

Endpoint terverifikasi dari SDK resmi (goapi-io/ex-sdk):
  base   : https://api.goapi.io/
  auth   : query param ?api_key=...
  prices : stock/idx/prices?symbols=BBCA&api_key=KEY   (banyak: BBRI,BBCA)
Parser respons dibuat defensif (cari field harga di mana pun dalam JSON), karena
struktur persis bisa berbeda antar paket. Tanpa key / gagal -> fallback yfinance.
Catatan: indeks IHSG (^JKSE) tetap via yfinance (GoAPI prices = saham saja).
"""
from __future__ import annotations

import requests

from models.quote import Quote
from providers.base import NETWORK, NO_DATA, Provider, ProviderResult
from providers.keys import get_key

_PRICE_KEYS = ("close", "last", "last_price", "lastprice", "price", "lasttradedprice",
               "ltp", "regularmarketprice", "last_trade_price")
_PREV_KEYS = ("previous_close", "previousclose", "prev_close", "prev", "previous",
              "prev_price", "close_previous", "penutupan_sebelumnya")
_CHG_KEYS = ("change", "change_value", "net_change", "selisih")


def _dig(obj, keys):
    """Cari nilai numerik untuk salah satu key (lower-case) di JSON bersarang."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in keys and isinstance(v, (int, float)):
                return float(v)
        for v in obj.values():
            r = _dig(v, keys)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _dig(v, keys)
            if r is not None:
                return r
    return None


class GoApiProvider(Provider):
    name = "goapi"
    asset_classes = ("equity",)
    BASE = "https://api.goapi.io/stock/idx"

    def _key(self):
        return get_key("GOAPI_KEY")

    def supports(self, symbol: str) -> bool:
        return bool(self._key()) and symbol.endswith(".JK")

    def get_quote(self, symbol: str) -> ProviderResult:
        key = self._key()
        if not key:
            return ProviderResult.fail(NO_DATA, "GOAPI_KEY belum diatur", self.name)
        tkr = symbol.replace(".JK", "")
        try:
            r = requests.get(f"{self.BASE}/prices",
                             params={"symbols": tkr, "api_key": key}, timeout=8)
            if r.status_code != 200:
                return ProviderResult.fail(NETWORK, f"HTTP {r.status_code}", self.name)
            data = r.json()
            if isinstance(data, dict) and str(data.get("status", "")).lower() in ("error", "fail"):
                return ProviderResult.fail(NO_DATA, str(data.get("message", "GoAPI error")), self.name)
            price = _dig(data, _PRICE_KEYS)
            if price is None:
                return ProviderResult.fail(NO_DATA, "harga tak ditemukan di respons GoAPI", self.name)
            prev = _dig(data, _PREV_KEYS)
            if prev is None:
                chg = _dig(data, _CHG_KEYS)
                prev = price - chg if chg is not None else 0.0
            return ProviderResult.success(
                Quote(symbol=symbol, price=price, previous_close=prev or 0.0,
                      open=_dig(data, ("open",)) or 0.0,
                      day_high=_dig(data, ("high",)) or 0.0,
                      day_low=_dig(data, ("low",)) or 0.0,
                      volume=_dig(data, ("volume",)) or 0.0,
                      currency="IDR", source=self.name), self.name)
        except Exception as e:  # noqa: BLE001
            return ProviderResult.fail(NETWORK, str(e), self.name)

    def get_history(self, symbol, period="1y", interval="1d") -> ProviderResult:
        return ProviderResult.fail(NO_DATA, "history via yfinance", self.name)
