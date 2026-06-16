"""Fixtures pytest — DB SQLite sementara per-test (tak menyentuh app.db pengguna)."""
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # folder saham-monitor/
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """DB sementara terisolasi. Reset koneksi singleton supaya reconnect ke temp DB."""
    import config
    import storage
    monkeypatch.setattr(config, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(config, "CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setattr(config, "DB_PATH", str(tmp_path / "test.db"))
    storage.get_conn.clear()
    storage.get_conn()  # buat skema baru
    yield storage
    storage.get_conn.clear()
