"""Test logika finansial inti: WAC, P/L realized, dan guard oversell."""
from types import SimpleNamespace


def _patch_quote(monkeypatch, price=1000.0, change=0.0):
    from services import market_service as ms
    monkeypatch.setattr(ms, "get_quote_obj", lambda sym: SimpleNamespace(price=price, change=change))


def test_wac_and_unrealized(temp_db, monkeypatch):
    from services import portfolio_service as ps
    _patch_quote(monkeypatch, price=1200.0)
    temp_db.add_transaction("2026-01-01", "TST.JK", "BUY", 10, 1000.0, 0)   # 1000 sh @1000
    temp_db.add_transaction("2026-02-01", "TST.JK", "BUY", 10, 1200.0, 0)   # +1000 sh @1200
    pos, tot = ps.build_positions()
    p = [x for x in pos if x["symbol"] == "TST.JK"][0]
    assert p["lots"] == 20
    assert round(p["avg"]) == 1100          # weighted average cost
    assert round(p["market"]) == 2400000    # 2000 sh * 1200
    assert round(p["unrealized"]) == 200000  # market - cost(2.2jt)


def test_realized_pl_on_sell(temp_db, monkeypatch):
    from services import portfolio_service as ps
    _patch_quote(monkeypatch, price=1500.0)
    temp_db.add_transaction("2026-01-01", "TST.JK", "BUY", 10, 1000.0, 0)   # 1000 sh @1000
    temp_db.add_transaction("2026-02-01", "TST.JK", "SELL", 4, 1500.0, 0)   # jual 400 sh @1500
    pos, tot = ps.build_positions()
    # realized = 400 * (1500 - 1000) = 200000
    assert round(tot["realized"]) == 200000
    p = [x for x in pos if x["symbol"] == "TST.JK"][0]
    assert p["lots"] == 6  # sisa 600 sh


def test_oversell_is_clamped(temp_db, monkeypatch):
    from services import portfolio_service as ps
    _patch_quote(monkeypatch, price=1100.0)
    temp_db.add_transaction("2026-01-01", "TST.JK", "BUY", 5, 1000.0, 0)    # 500 sh
    temp_db.add_transaction("2026-02-01", "TST.JK", "SELL", 10, 1100.0, 0)  # oversell: cuma 500 dipegang
    temp_db.add_transaction("2026-03-01", "TST.JK", "BUY", 3, 1200.0, 0)    # +300 sh
    pos, tot = ps.build_positions()
    p = [x for x in pos if x["symbol"] == "TST.JK"][0]
    assert p["shares"] == 300         # 500 - 500(clamp) + 300, BUKAN negatif
    assert p["shares"] >= 0
    assert p["cost"] >= 0
    # realized hanya dari 5 lot yang benar-benar terjual: 500 * (1100 - 1000)
    assert round(tot["realized"]) == 50000


def test_fee_reduces_cost_basis(temp_db, monkeypatch):
    from services import portfolio_service as ps
    _patch_quote(monkeypatch, price=1000.0)
    temp_db.add_transaction("2026-01-01", "TST.JK", "BUY", 10, 1000.0, 5000)  # fee 5000
    pos, tot = ps.build_positions()
    p = [x for x in pos if x["symbol"] == "TST.JK"][0]
    assert round(p["cost"]) == 1005000  # 1.000.000 + fee 5.000
    assert round(tot["fees"]) == 5000


def test_empty_portfolio(temp_db):
    from services import portfolio_service as ps
    pos, tot = ps.build_positions()
    assert pos == []
    assert tot["realized"] == 0.0
