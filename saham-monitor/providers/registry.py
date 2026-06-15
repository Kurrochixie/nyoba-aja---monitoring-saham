"""Registry provider — urutan = prioritas (fallback chain).

Realtime/fundamental spesialis didahulukan; yfinance catch-all paling akhir.
Provider opsional aktif hanya jika API key tersedia (lihat supports()).
"""
from __future__ import annotations

from providers.base import Provider
from providers.goapi_provider import GoApiProvider
from providers.sectors_provider import SectorsProvider
from providers.yfinance_provider import YFinanceProvider

_PROVIDERS: list[Provider] = []


def register(provider: Provider) -> None:
    if not any(p.name == provider.name for p in _PROVIDERS):
        _PROVIDERS.append(provider)


def providers() -> list[Provider]:
    return list(_PROVIDERS)


def for_symbol(symbol: str) -> Provider | None:
    for p in _PROVIDERS:
        if p.supports(symbol):
            return p
    return _PROVIDERS[0] if _PROVIDERS else None


register(GoApiProvider())     # realtime quote IDX (jika GOAPI_KEY)
register(SectorsProvider())   # fundamental IDX (jika SECTORS_KEY)
register(YFinanceProvider())  # catch-all gratis
