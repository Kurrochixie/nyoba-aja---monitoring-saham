"""Kontrak Provider + envelope hasil seragam.

Pola ini meniru ide Fincept (error-by-convention dengan error_code, model typed
terpisah dari fetch), tapi dijalankan in-process (tanpa subprocess/JSON bridge).
UI selalu cek `result.ok`; tidak pernah menebak bentuk error.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

# Kode error standar (mirror konsep error_code di skrip Fincept)
OK = "OK"
NO_DATA = "NO_DATA"
RATE_LIMITED = "RATE_LIMITED"
AUTH = "AUTH"
NETWORK = "NETWORK"
BAD_SYMBOL = "BAD_SYMBOL"
UNKNOWN = "UNKNOWN"


@dataclass
class ProviderResult:
    """Envelope seragam untuk semua pemanggilan provider."""
    ok: bool
    data: Any = None
    error_code: str = OK
    error: str = ""
    source: str = ""

    @classmethod
    def success(cls, data: Any, source: str = "") -> "ProviderResult":
        return cls(ok=True, data=data, error_code=OK, source=source)

    @classmethod
    def fail(cls, code: str, msg: str, source: str = "") -> "ProviderResult":
        return cls(ok=False, data=None, error_code=code, error=msg, source=source)


class Provider(ABC):
    """Kelas dasar setiap sumber data.

    Subclass WAJIB meng-implement supports(), get_quote(), get_history().
    get_fundamentals() & search() opsional (default: NO_DATA).
    """

    name: str = "base"
    asset_classes: tuple[str, ...] = ("equity",)

    @abstractmethod
    def supports(self, symbol: str) -> bool:
        """True jika provider ini bisa menangani simbol tersebut."""

    @abstractmethod
    def get_quote(self, symbol: str) -> ProviderResult:
        """Snapshot harga terkini (-> models.quote.Quote)."""

    @abstractmethod
    def get_history(self, symbol: str, period: str = "1y",
                    interval: str = "1d") -> ProviderResult:
        """OHLCV historis (-> pandas.DataFrame: Open/High/Low/Close/Volume)."""

    def get_fundamentals(self, symbol: str) -> ProviderResult:
        return ProviderResult.fail(NO_DATA, f"fundamentals tidak didukung oleh {self.name}", self.name)

    def search(self, query: str) -> ProviderResult:
        return ProviderResult.fail(NO_DATA, f"search tidak didukung oleh {self.name}", self.name)
