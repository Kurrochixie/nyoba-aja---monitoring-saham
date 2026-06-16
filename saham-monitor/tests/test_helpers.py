"""Test fungsi murni: validasi input, sanitasi JSON, sentimen, cache."""
import pytest
from pydantic import ValidationError


def test_clean_symbol():
    import api
    assert api._clean_symbol("bbca") == "BBCA"
    assert api._clean_symbol(" antm.jk ") == "ANTM.JK"
    with pytest.raises(ValueError):
        api._clean_symbol("BB/CA;DROP")
    with pytest.raises(ValueError):
        api._clean_symbol("X" * 20)


def test_jsonable_nan_inf():
    import api
    out = api._jsonable({"a": float("nan"), "b": [1.0, float("inf"), 2], "c": "x", "d": 3})
    assert out["a"] is None
    assert out["b"] == [1.0, None, 2]
    assert out["c"] == "x" and out["d"] == 3


def test_txnin_normalizes_and_rejects():
    import api
    ok = api.TxnIn(date="2026-06-15", code="bbca", type="buy", lot=5, price=6000)
    assert ok.type == "BUY" and ok.code == "BBCA"
    bads = [
        dict(date="2026-06-15", code="BBCA", type="HOLD", lot=5, price=6000),  # type invalid
        dict(date="2026-06-15", code="BBCA", type="BUY", lot=0, price=6000),   # lot 0
        dict(date="2026-06-15", code="BBCA", type="BUY", lot=5, price=0),      # price 0
        dict(date="bukan-tanggal", code="BBCA", type="BUY", lot=5, price=6000),  # tanggal invalid
        dict(date="2026-06-15", code="BB/CA", type="BUY", lot=5, price=6000),  # simbol invalid
    ]
    for bad in bads:
        with pytest.raises(ValidationError):
            api.TxnIn(**bad)


def test_rulein_value_must_be_numeric():
    import api
    api.RuleIn(symbol="BBCA", metric="Harga", op=">=", value="7.000")  # ok
    with pytest.raises(ValidationError):
        api.RuleIn(symbol="BBCA", metric="Harga", op=">=", value="abc")


def test_score_sentiment():
    from services.news_service import score_sentiment
    assert score_sentiment("IHSG melonjak, saham menguat tajam")[1] == "positif"
    assert score_sentiment("Saham anjlok, investor merugi")[1] == "negatif"
    assert score_sentiment("Rapat dijadwalkan pekan depan")[1] == "netral"


def test_ttl_cache_memoizes_and_clears():
    from cache import ttl_cache
    calls = {"n": 0}

    @ttl_cache(60)
    def f(x):
        calls["n"] += 1
        return x * 2

    assert f(3) == 6
    assert f(3) == 6
    assert calls["n"] == 1  # panggilan kedua dari cache
    f.clear()
    assert f(3) == 6
    assert calls["n"] == 2  # setelah clear, hitung ulang
