"""Portofolio: bangun posisi dari transaksi (WAC), P/L realized/unrealized, metrik."""
from __future__ import annotations

import pandas as pd

import config
import storage
from services import market_service as ms


def build_positions() -> tuple[list[dict], dict]:
    """Return (positions, totals). WAC = weighted average cost (incl. fee beli)."""
    txns = storage.get_transactions()
    book: dict[str, dict] = {}
    for t in txns:
        sym = t["symbol"]
        b = book.setdefault(sym, {"shares": 0.0, "cost": 0.0, "realized": 0.0, "fees": 0.0})
        shares = float(t["shares"])
        price = float(t["price"])
        fee = float(t["fee"] or 0.0)
        b["fees"] += fee
        if t["type"] == "BUY":
            b["cost"] += shares * price + fee
            b["shares"] += shares
        else:  # SELL — clamp agar tak oversell (shares/cost negatif merusak P/L)
            sell = min(shares, b["shares"]) if b["shares"] > 0 else 0.0
            avg = b["cost"] / b["shares"] if b["shares"] > 0 else 0.0
            b["realized"] += sell * price - avg * sell - fee
            b["cost"] = max(0.0, b["cost"] - avg * sell)
            b["shares"] = max(0.0, b["shares"] - sell)

    positions, tot = [], {
        "cost": 0.0, "market": 0.0, "unrealized": 0.0, "realized": 0.0,
        "day": 0.0, "fees": 0.0,
    }
    for sym, b in book.items():
        tot["realized"] += b["realized"]
        tot["fees"] += b["fees"]
        if b["shares"] <= 1e-6:
            continue
        q = ms.get_quote_obj(sym)
        last = q.price if q else 0.0
        day_chg = q.change if q else 0.0
        avg = b["cost"] / b["shares"] if b["shares"] > 0 else 0.0
        market = b["shares"] * last
        unreal = market - b["cost"]
        positions.append({
            "symbol": sym, "shares": b["shares"], "lots": int(b["shares"] / config.LOT_SIZE),
            "avg": avg, "last": last, "cost": b["cost"], "market": market,
            "unrealized": unreal, "unrealized_pct": (unreal / b["cost"] * 100 if b["cost"] else 0.0),
            "day": b["shares"] * day_chg, "realized": b["realized"],
        })
        tot["cost"] += b["cost"]
        tot["market"] += market
        tot["unrealized"] += unreal
        tot["day"] += b["shares"] * day_chg

    positions.sort(key=lambda p: p["market"], reverse=True)
    tot["total_pl"] = tot["unrealized"] + tot["realized"]
    tot["total_pl_pct"] = (tot["unrealized"] / tot["cost"] * 100) if tot["cost"] else 0.0
    for p in positions:
        p["weight"] = (p["market"] / tot["market"] * 100) if tot["market"] else 0.0
    return positions, tot


def nav_series(period: str = "1y") -> pd.Series | None:
    """Nilai portofolio harian (replay transaksi terhadap close historis)."""
    try:
        txns = storage.get_transactions()
        if not txns:
            return None
        syms = sorted({t["symbol"] for t in txns})
        closes = {}
        for s in syms:
            df, _ = ms.get_history(s, period=period)
            if df is None or df.empty:
                continue
            c = df["Close"].copy()
            idx = pd.DatetimeIndex(c.index)
            try:
                idx = idx.tz_localize(None)
            except (TypeError, AttributeError):
                pass
            c.index = idx.normalize()
            c = c[~c.index.duplicated(keep="last")]
            closes[s] = c
        if not closes:
            return None
        union = None
        for c in closes.values():
            union = c.index if union is None else union.union(c.index)
        union = union.sort_values()
        nav = pd.Series(0.0, index=union)
        for s, c in closes.items():
            c = c.reindex(union).ffill()
            deltas = pd.Series(0.0, index=union)
            for t in txns:
                if t["symbol"] != s:
                    continue
                d = pd.Timestamp(t["date"]).normalize()
                pos = union.searchsorted(d)
                if pos >= len(union):
                    continue
                deltas.iloc[pos] += float(t["shares"]) if t["type"] == "BUY" else -float(t["shares"])
            shares = deltas.cumsum()
            nav = nav.add((shares * c).fillna(0.0), fill_value=0.0)
        nav = nav[nav > 0]
        return nav if len(nav) > 1 else None
    except Exception:
        return None


def metrics_from_nav(nav: pd.Series | None) -> dict:
    if nav is None or len(nav) < 2:
        return {}
    ret = nav.iloc[-1] / nav.iloc[0] - 1
    roll_max = nav.cummax()
    mdd = ((nav - roll_max) / roll_max).min()
    daily = nav.pct_change().dropna()
    sharpe = 0.0
    if len(daily) > 5 and daily.std() > 0:
        sharpe = (daily.mean() - config.RF_RATE / 252) / daily.std() * (252 ** 0.5)
    return {"total_return": ret * 100, "max_drawdown": mdd * 100, "sharpe": sharpe}
