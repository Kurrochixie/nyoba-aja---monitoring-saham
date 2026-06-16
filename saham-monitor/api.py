"""FastAPI bridge — menyajikan frontend React (webapp/) + data IHSG live.

Endpoint /api/bootstrap mengembalikan data dengan BENTUK yang sama seperti
webapp/app/data.js (window.SM), diisi dari service Python yang sudah ada
(market_service, news_service). Frontend menimpa data mock dengan data live ini.

Jalankan:  python -m uvicorn api:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import concurrent.futures as cf
import logging
import math
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.basicConfig(
    level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("streamlit").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.WARNING)

from fastapi import FastAPI                       # noqa: E402
from fastapi.responses import JSONResponse        # noqa: E402
from fastapi.staticfiles import StaticFiles       # noqa: E402
from pydantic import BaseModel, Field, field_validator  # noqa: E402
from apscheduler.schedulers.background import BackgroundScheduler  # noqa: E402

import config                                      # noqa: E402
import utils                                        # noqa: E402
from providers.keys import get_key                  # noqa: E402
from services import (                              # noqa: E402
    alert_service as als, indicators, market_service as ms,
    news_service as ns, portfolio_service as ps,
)

WEBAPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "webapp")

# Warna badge per kode (selaras palet design); fallback hash bila tak ada.
COLOR_MAP = {
    "ANTM": "#E8902C", "ASII": "#2C6FE0", "BBCA": "#1B4FA0", "BBRI": "#0E63AE",
    "BMRI": "#173E7C", "BBNI": "#F47B20", "TLKM": "#C8102E", "BUMI": "#5B7A1E",
    "GOTO": "#00AA13", "CDIA": "#7A4DD6", "DCII": "#0E9488", "ADRO": "#0B7C4F",
    "PTBA": "#1F7A3D", "UNVR": "#1F4E9B", "ICBP": "#C8102E", "INDF": "#D7261E",
    "MDKA": "#C0392B", "AMMN": "#0E7C86", "BRPT": "#1463A0", "TPIA": "#1463A0",
}
SECTOR_MAP = {
    "ANTM": "Basic Materials", "INCO": "Basic Materials", "MDKA": "Basic Materials",
    "ANTM.JK": "Basic Materials", "TPIA": "Basic Materials", "BRPT": "Basic Materials",
    "ASII": "Industrials", "UNTR": "Industrials",
    "BBCA": "Financials", "BBRI": "Financials", "BMRI": "Financials", "BBNI": "Financials",
    "BRIS": "Financials", "BBTN": "Financials", "ARTO": "Financials",
    "TLKM": "Communications", "ISAT": "Communications", "EXCL": "Communications", "TOWR": "Communications",
    "BUMI": "Energy", "ADRO": "Energy", "PTBA": "Energy", "ITMG": "Energy", "MEDC": "Energy",
    "PGAS": "Energy", "CDIA": "Energy", "AKRA": "Energy",
    "GOTO": "Technology", "BUKA": "Technology", "EMTK": "Technology", "DCII": "Technology",
    "UNVR": "Consumer", "ICBP": "Consumer", "INDF": "Consumer", "AMRT": "Consumer",
    "GGRM": "Consumer", "HMSP": "Consumer", "MAPI": "Consumer", "ACES": "Consumer",
    "KLBF": "Healthcare", "SIDO": "Healthcare",
}


def _id(n, dec=0):
    try:
        s = f"{float(n):,.{dec}f}"
    except (TypeError, ValueError):
        return "—"
    return s.replace(",", "\0").replace(".", ",").replace("\0", ".")


def fmt_vol(v):
    v = float(v or 0)
    for div, suf in ((1e12, "T"), (1e9, "M"), (1e6, "Jt"), (1e3, "rb")):
        if v >= div:
            return _id(v / div, 1) + " " + suf
    return _id(v, 0)


def _spark(symbol, period):
    df, _ = ms.get_history(symbol, period=period)
    if df is None or df.empty:
        return []
    # buang NaN (hari libur/gap) — NaN merusak JSON & sparkline (x != x untuk NaN)
    return [round(float(x), 2) for x in df["Close"].tolist() if x == x]


def _jsonable(o):
    """Sanitasi rekursif: NaN/Inf → None agar JSON tidak gagal (allow_nan=False)."""
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    return o


def build_ihsg():
    q = ms.get_quote_obj("^JKSE")
    if not q:
        return None
    return {
        "code": "IHSG", "name": "IDX Composite",
        "price": round(q.price, 2), "chg": round(q.change, 2), "chgPct": round(q.change_pct, 2),
        "high": round(q.day_high, 2), "low": round(q.day_low, 2), "open": round(q.open, 2),
        "vol": fmt_vol(q.volume) + " lot", "value": "—",
        "spark": _spark("^JKSE", "3mo")[-60:],
    }


def _stock(sym):
    code = utils.short_code(sym)
    try:
        q = ms.get_quote_obj(sym)
    except Exception:
        q = None
    if not q:
        # Placeholder: tetap tampilkan emiten (data belum tersedia) — JANGAN hilangkan dari watchlist.
        return {
            "code": code, "name": utils.display_name(sym), "sector": SECTOR_MAP.get(code, ""),
            "price": 0, "chg": 0, "chgPct": 0, "high": None, "low": None,
            "vol": "—", "volume": 0, "color": COLOR_MAP.get(code, "#3B6FB0"),
            "prevClose": 0, "spark": [], "seed": sum(ord(c) for c in code) % 900 + 10,
            "volat": 0.02, "stale": True,
        }
    return {
        "code": code, "name": utils.display_name(sym),
        "sector": SECTOR_MAP.get(code, ""),
        "price": round(q.price, 2), "chg": round(q.change, 2), "chgPct": round(q.change_pct, 2),
        "high": round(q.day_high, 2) if q.day_high else None,
        "low": round(q.day_low, 2) if q.day_low else None,
        "vol": fmt_vol(q.volume),
        "volume": int(q.volume) if (q.volume is not None and q.volume == q.volume) else 0,
        "color": COLOR_MAP.get(code, "#3B6FB0"),
        "prevClose": round(q.previous_close, 2),
        "spark": _spark(sym, "1mo")[-30:],
        "seed": sum(ord(c) for c in code) % 900 + 10,  # dipakai genCandles chart riset
        "volat": 0.02,
    }


def build_stocks(symbols):
    eq = [s for s in symbols if not s.startswith("^")]
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(_stock, eq))
    return [r for r in res if r]


def build_market(stocks=None):
    is_open = utils.is_market_open()
    stocks = stocks or []
    adv = sum(1 for s in stocks if (s.get("chgPct") or 0) > 0)
    dec = sum(1 for s in stocks if (s.get("chgPct") or 0) < 0)
    unch = max(0, len(stocks) - adv - dec)
    return {
        "status": "open" if is_open else "closed",
        "clock": f"{utils.now_wib():%H:%M} WIB",
        "feed": "realtime" if ms.is_realtime() else "delayed",
        "feedDelay": 15,
        # Breadth dari WATCHLIST (bukan seluruh IDX) — jujur soal sumbernya.
        "advancers": adv, "decliners": dec, "unchanged": unch, "breadthScope": "watchlist",
    }


def build_sectors(stocks):
    groups = {}
    for s in stocks:
        sec = s.get("sector")
        if sec:
            groups.setdefault(sec, []).append(s["chgPct"])
    out = [{"name": k, "chg": round(sum(v) / len(v), 1)} for k, v in groups.items()]
    out.sort(key=lambda x: x["chg"], reverse=True)
    return out or None


_REG_WORDS = ("OJK", "BEI", "BURSA EFEK", "DENDA", "SANKSI", "REGULASI", "ATURAN",
              "POJK", "DELISTING", "SUSPENSI", "SUSPEND", "DIHUKUM", "IDX")


def _derive_tag(title, codes):
    """Tag berita: kode emiten watchlist bila disebut di judul, lalu Regulasi, default Pasar."""
    up = (title or "").upper()
    for code in codes:
        if re.search(r"\b" + re.escape(code) + r"\b", up):
            return code
    if any(w in up for w in _REG_WORDS):
        return "Regulasi"
    return "Pasar"


def _news_codes():
    """Kumpulan kode emiten untuk deteksi tag (watchlist diprioritaskan)."""
    import storage
    wl = [utils.short_code(s) for s in storage.get_watchlist() if not s.startswith("^")]
    known = [k.replace(".JK", "") for k in config.KNOWN_NAMES if not k.startswith("^")]
    return wl + [c for c in known if c not in wl]


def _format_news(items):
    """Ubah item RSS mentah jadi bentuk window.SM.NEWS (item + ringkasan sentimen)."""
    codes = _news_codes()
    smap = {"positif": "pos", "negatif": "neg", "netral": "neu"}
    out = []
    for it in items:
        when = ""
        if it.get("ts"):
            try:
                when = datetime.fromtimestamp(it["ts"]).strftime("%d %b · %H:%M")
            except Exception:
                when = ""
        out.append({"title": it["title"], "source": it.get("source", ""),
                    "time": when, "ts": it.get("ts", 0),
                    "sentiment": smap.get(it.get("sentiment"), "neu"),
                    "tag": _derive_tag(it["title"], codes), "link": it.get("link", "")})
    summary = {"total": len(out),
               "pos": sum(1 for x in out if x["sentiment"] == "pos"),
               "neg": sum(1 for x in out if x["sentiment"] == "neg"),
               "neu": sum(1 for x in out if x["sentiment"] == "neu")}
    return {"summary": summary, "items": out}


def build_news():
    try:
        return _format_news(ns.fetch_general(limit=18))
    except Exception:
        return None


def _seed_keywords_if_empty():
    """Kata kunci berita favorit; bila kosong → seed dari watchlist (saran awal)."""
    import storage
    kws = storage.get_news_keywords()
    if not kws:
        wl = [utils.short_code(s) for s in storage.get_watchlist() if not s.startswith("^")]
        for c in wl[:5]:
            storage.add_news_keyword(c)
        kws = storage.get_news_keywords()
    return kws


def _kw_query(kw):
    """Kode/nama pendek dibumbui 'saham' agar relevan ke bursa."""
    return kw if (" " in kw or len(kw) > 6) else (kw + " saham")


def build_news_stream():
    """Tab SEMUA = gabungan kata kunci favorit + feed pasar umum (dedup, urut terbaru)."""
    kws = _seed_keywords_if_empty()
    raw = []
    try:
        with cf.ThreadPoolExecutor(max_workers=6) as ex:
            futs = [ex.submit(ns.fetch_general, 18)]
            futs += [ex.submit(ns.fetch_for_query, _kw_query(kw), 12) for kw in kws[:8]]
            for f in cf.as_completed(futs):
                try:
                    raw.extend(f.result() or [])
                except Exception:
                    pass
    except Exception:
        try:
            raw = ns.fetch_general(18)
        except Exception:
            raw = []
    seen, merged = set(), []
    for it in sorted(raw, key=lambda x: x.get("ts", 0), reverse=True):
        k = (it.get("title") or "")[:80].lower()
        if k and k not in seen:
            seen.add(k)
            merged.append(it)
    out = _format_news(merged[:60])
    out["keywords"] = kws
    return out


def _compact(v):
    v = float(v or 0)
    for div, suf in ((1e12, "T"), (1e9, "M"), (1e6, "Jt")):
        if v >= div:
            return _id(v / div, 2) + " " + suf
    return _id(v, 0)


def _pct_str(v):
    if v is None:
        return "—"
    v = float(v)
    if abs(v) <= 1.5:
        v *= 100
    return _id(v, 2) + "%"


def _x(v):
    return _id(v, 2) + "x" if v is not None else "—"


def build_research_one(sym):
    code = utils.short_code(sym)
    q = ms.get_quote_obj(sym)
    if not q:
        return None
    f = ms.get_fundamentals(sym)
    rsi, rsi_state, verdict, signals = 50, "Netral", "NETRAL", []
    w52lo_h, w52hi_h = None, None
    df, _ = ms.get_history(sym, period="1y")
    if df is not None and not df.empty:
        try:
            _lo = "Low" if "Low" in df.columns else "Close"
            _hi = "High" if "High" in df.columns else "Close"
            w52lo_h, w52hi_h = float(df[_lo].min()), float(df[_hi].max())
        except Exception:
            pass
        enr = indicators.enrich(df)
        sigs = indicators.signals(enr)
        verdict = indicators.verdict_overall(sigs)[0]
        smap = {"up": "pos", "down": "neg", "flat": "neu"}
        for s in sigs:
            signals.append({"name": s["name"], "value": s["value"],
                            "state": smap.get(s["dir"], "neu"), "note": s["verdict"]})
            if s["name"].startswith("RSI"):
                try:
                    rsi = int(float(s["value"]))
                except Exception:
                    pass
                rsi_state = s["verdict"]
    # Konsensus analis & ringkasan keuangan NYATA dari yfinance (.info di f.raw); None bila tak ada.
    raw = (f.raw if (f and getattr(f, "raw", None)) else {}) or {}
    consensus = None
    _tgt = raw.get("targetMeanPrice")
    if _tgt:
        _rec = (raw.get("recommendationKey") or "").replace("_", " ").strip().title()
        _na = raw.get("numberOfAnalystOpinions")
        consensus = {
            "targetLow": round(raw.get("targetLowPrice") or _tgt),
            "targetAvg": round(_tgt),
            "targetHigh": round(raw.get("targetHighPrice") or _tgt),
            "upside": round((_tgt - q.price) / q.price * 100, 1) if q.price else 0,
            "recommendation": _rec or None,
            "analysts": int(_na) if _na else None,
        }
    financials = None
    _rev, _ni = raw.get("totalRevenue"), raw.get("netIncomeToCommon")
    if _rev or _ni:
        def _pg(k):
            v = raw.get(k)
            return round(v * 100, 1) if isinstance(v, (int, float)) else None
        financials = {
            "revenue": _compact(_rev) if _rev else "—",
            "netIncome": _compact(_ni) if _ni else "—",
            "revenueGrowth": _pg("revenueGrowth"), "earningsGrowth": _pg("earningsGrowth"),
            "grossMargin": _pg("grossMargins"), "profitMargin": _pg("profitMargins"),
            "period": "TTM (tahunan)",
        }
    return {
        "code": code, "name": ms.get_name(sym),
        "consensus": consensus, "financials": financials,
        "sector": (f.sector if f and f.sector else SECTOR_MAP.get(code, "")),
        "industry": (f.industry if f and f.industry else ""),
        "price": round(q.price, 2), "chg": round(q.change, 2), "chgPct": round(q.change_pct, 2),
        "high": round(q.day_high, 2), "low": round(q.day_low, 2), "open": round(q.open, 2),
        "vol": fmt_vol(q.volume),
        "mcap": _compact(f.market_cap) if f and f.market_cap else "—",
        "per": _x(f.per) if f else "—", "pbv": _x(f.pbv) if f else "—",
        "divYield": _pct_str(f.dividend_yield if f else None),
        "eps": _id(f.eps, 0) if f and f.eps else "—",
        "bookValue": _id(f.book_value, 0) if f and f.book_value else "—",
        "roe": _pct_str(f.roe if f else None), "netMargin": _pct_str(f.profit_margin if f else None),
        "der": _x(f.de_ratio) if f and f.de_ratio else "—",
        "beta": _id(f.beta, 2) if f and f.beta else "—",
        "w52low": round(f.week52_low) if f and f.week52_low else (round(w52lo_h) if w52lo_h else round(q.day_low)),
        "w52high": round(f.week52_high) if f and f.week52_high else (round(w52hi_h) if w52hi_h else round(q.day_high)),
        "rsi": rsi, "rsiState": rsi_state, "verdict": verdict,
        "signals": signals or [{"name": "—", "value": "—", "state": "neu", "note": ""}],
    }


def build_research(symbols):
    eq = [s for s in symbols if not s.startswith("^")]
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(build_research_one, eq))
    return {r["code"]: r for r in res if r} or None


def build_portfolio():
    import storage
    txns = storage.get_transactions()
    if not txns:
        return {"marketValue": 0, "marketValueChg": 0, "marketValueChgPct": 0,
                "totalCost": 0, "unrealized": 0, "unrealizedPct": 0, "realized": 0,
                "metrics": {"totalReturn": 0, "maxDrawdown": 0, "sharpe": 0},
                "positions": [], "history": [], "nav": []}
    positions, tot = ps.build_positions()
    nav = ps.nav_series("1y")
    mt = ps.metrics_from_nav(nav) if nav is not None else {}
    navlist = [round(float(x)) for x in nav.tolist()] if nav is not None else []
    pos = [{
        "code": utils.short_code(p["symbol"]), "name": utils.display_name(p["symbol"]),
        "lot": p["lots"], "avg": round(p["avg"]), "last": round(p["last"]),
        "value": round(p["market"]), "pl": round(p["unrealized"]),
        "plPct": round(p["unrealized_pct"], 1), "weight": round(p["weight"]),
        "color": COLOR_MAP.get(utils.short_code(p["symbol"]), "#3B6FB0"),
    } for p in positions]
    base = tot["market"] - tot["day"]
    hist = [{"id": t["id"], "date": t["date"], "code": utils.short_code(t["symbol"]), "type": t["type"],
             "lot": t["lots"], "price": round(t["price"]), "fee": round(t["fee"])}
            for t in reversed(txns)]
    return {
        "marketValue": round(tot["market"]), "marketValueChg": round(tot["day"]),
        "marketValueChgPct": round(tot["day"] / base * 100, 2) if base > 0 else 0,
        "totalCost": round(tot["cost"]), "unrealized": round(tot["unrealized"]),
        "unrealizedPct": round(tot["total_pl_pct"], 2), "realized": round(tot["realized"]),
        "metrics": {"totalReturn": round(mt.get("total_return", 0), 2),
                    "maxDrawdown": round(mt.get("max_drawdown", 0), 1),
                    "sharpe": round(mt.get("sharpe", 0), 2)},
        "positions": pos, "history": hist, "nav": navlist,
    }


def build_alerts():
    import storage
    channels = [
        {"name": "In-app", "desc": "Notifikasi di dalam aplikasi", "on": True, "ic": "bell"},
        {"name": "Telegram", "desc": "Bot Telegram", "on": bool(get_key("TG_TOKEN")), "ic": "send"},
        {"name": "Desktop", "desc": "Notifikasi sistem operasi", "on": True, "ic": "monitor"},
    ]
    metmap = {"price": "Harga", "change_pct": "Perubahan %"}
    active = [{
        "id": r["id"], "code": utils.short_code(r["symbol"]),
        "metric": metmap.get(r["metric"], r["metric"]), "cond": r["op"],
        "value": _id(r["value"], 0), "channels": (r["channel"] or "in-app").split("+"),
        "cooldown": r["cooldown_min"], "on": bool(r["active"]),
    } for r in storage.get_rules()]
    history = [{"text": e["detail"], "time": e["fired_at"], "state": "pos"}
               for e in storage.get_alert_events(20)]
    return {"active": active, "history": history, "channels": channels}


_scheduler = None


@asynccontextmanager
async def lifespan(_app):
    """Evaluasi alert berkala (edge-trigger + cooldown) selama server hidup."""
    global _scheduler

    def _eval():
        try:
            fired = als.evaluate()
            if fired:
                logging.info("alerts fired: %s", [f["detail"] for f in fired])
        except Exception as e:  # noqa: BLE001
            logging.error("alert eval: %s", e)

    _scheduler = BackgroundScheduler(timezone="Asia/Jakarta")
    _scheduler.add_job(_eval, "interval", seconds=60, id="alert_eval", max_instances=1)
    _scheduler.start()
    yield
    try:
        _scheduler.shutdown(wait=False)
    except Exception:
        pass


app = FastAPI(title="Saham Monitor API", lifespan=lifespan)

# Tolak Host header non-loopback (cegah DNS-rebinding). App ini memang hanya untuk lokal.
from starlette.middleware.trustedhost import TrustedHostMiddleware  # noqa: E402
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])


@app.middleware("http")
async def no_cache(request, call_next):
    """Local dev: jangan cache aset webapp supaya edit JSX/CSS langsung kelihatan."""
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


@app.get("/api/news")
def search_news(q: str = ""):
    """Pencarian berita nyata: query ke Google News RSS (bukan filter lokal).
    Tanpa q → feed pasar umum. Kode/nama pendek dibumbui 'saham' agar relevan."""
    q = (q or "").strip()
    if not q:
        return build_news() or {"summary": {"total": 0, "pos": 0, "neg": 0, "neu": 0}, "items": []}
    try:
        raw = ns.fetch_for_query(_kw_query(q), limit=24)
    except Exception:
        raw = []
    return _format_news(raw)


@app.get("/api/news/stream")
def news_stream():
    """Tab SEMUA: gabungan kata kunci favorit + feed pasar umum."""
    return build_news_stream()


class KeywordIn(BaseModel):
    keyword: str = Field(min_length=1, max_length=40)


@app.post("/api/news-keywords")
def add_news_kw(b: KeywordIn):
    import storage
    kw = (b.keyword or "").strip()
    if kw:
        storage.add_news_keyword(kw)
    return {"ok": True, "keywords": storage.get_news_keywords()}


@app.delete("/api/news-keywords/{keyword}")
def del_news_kw(keyword: str):
    import storage
    storage.remove_news_keyword(keyword)
    return {"ok": True, "keywords": storage.get_news_keywords()}


_ID_MON = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _candle_label(ts, mode):
    """Label tanggal candle (Bahasa Indonesia). mode: intra / long / day."""
    m = _ID_MON[ts.month] if 1 <= ts.month <= 12 else "?"
    if mode == "intra":
        return f"{ts.day} {m} {ts:%H:%M}", f"{ts:%H:%M}"
    if mode == "long":
        return f"{ts.day} {m} {ts.year}", f"{m} '{str(ts.year)[2:]}"
    return f"{ts.day} {m} {ts.year}", f"{ts.day} {m}"


@app.get("/api/candles")
def candles(code: str, range: str = "1H"):
    """Candle NYATA untuk chart Bawaan.
    range intraday: 1H (1d/5m), 5H (5d/15m). range harian: 1B/3B/6B/1T/3T/5T (yfinance)."""
    sym = utils.normalize_symbol(code)
    intraday = range in config.INTRADAY
    interval = "1d"
    df = None
    if intraday:
        period, interval = config.INTRADAY[range]
        try:
            df, _ = ms.get_intraday(sym, period=period, interval=interval)
        except Exception:
            df = None
    elif range in config.PERIODS:
        try:
            df, _ = ms.get_history(sym, period=config.PERIODS[range])
        except Exception:
            df = None
    else:
        return {"ok": False, "candles": [], "dates": []}
    if df is None or df.empty:
        return {"ok": False, "candles": [], "dates": []}
    mode = "intra" if intraday else ("long" if range in ("3T", "5T") else "day")
    out_c, out_d = [], []
    for ts, row in df.iterrows():
        try:
            o, h_, lo, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
        except Exception:
            continue
        if c != c:  # NaN
            continue
        vol = row["Volume"] if "Volume" in row.index else 0
        v = int(vol) if vol == vol else 0
        out_c.append({"o": round(o, 2), "h": round(h_, 2), "l": round(lo, 2), "c": round(c, 2), "v": v})
        try:
            full, axis = _candle_label(ts, mode)
            out_d.append({"full": full, "axis": axis})
        except Exception:
            out_d.append({"full": "", "axis": ""})
    return {"ok": bool(out_c), "candles": out_c, "dates": out_d, "interval": interval}


@app.post("/api/alerts/evaluate")
def eval_alerts():
    return {"fired": [f["detail"] for f in als.evaluate()]}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap():
    import storage
    symbols = storage.get_watchlist()
    out = {}
    try:
        ihsg = build_ihsg()
        if ihsg:
            out["IHSG"] = ihsg
    except Exception as e:  # noqa: BLE001
        logging.error("ihsg: %s", e)
    try:
        stocks = build_stocks(symbols)
        if stocks:
            out["STOCKS"] = stocks
            sectors = build_sectors(stocks)
            if sectors:
                out["SECTORS"] = sectors
    except Exception as e:  # noqa: BLE001
        logging.error("stocks: %s", e)
    out["MARKET"] = build_market(out.get("STOCKS"))
    news = build_news()
    # Saat feed mati: kirim NEWS kosong-valid (jangan biarkan UI tampilkan berita mock lama).
    out["NEWS"] = news if news else {"summary": {"total": 0, "pos": 0, "neg": 0, "neu": 0}, "items": []}
    try:
        out["NEWS"]["keywords"] = _seed_keywords_if_empty()
    except Exception:
        pass
    try:
        research = build_research(symbols)
        if research:
            out["RESEARCH"] = research
    except Exception as e:  # noqa: BLE001
        logging.error("research: %s", e)
    try:
        pf = build_portfolio()
        if pf:
            out["PORTFOLIO"] = pf
    except Exception as e:  # noqa: BLE001
        logging.error("portfolio: %s", e)
    try:
        al = build_alerts()
        if al:
            out["ALERTS"] = al
    except Exception as e:  # noqa: BLE001
        logging.error("alerts: %s", e)
    try:
        fired = als.evaluate(quotes={})
        if fired:
            out["_fired"] = [f["detail"] for f in fired]
    except Exception as e:  # noqa: BLE001
        logging.error("alert eval: %s", e)
    return JSONResponse(_jsonable(out))


_OPMAP = {"≥": ">=", "≤": "<=", "＞": ">", "＜": "<", ">": ">", "<": "<", ">=": ">=", "<=": "<="}


def _num(s):
    s = str(s).replace(".", "").replace(",", ".").replace("−", "-").replace("–", "-")
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def _iso_date(s):
    try:
        import pandas as pd
        return pd.Timestamp(s).strftime("%Y-%m-%d")
    except Exception:
        return str(s)


_SYM_RE = r"[A-Z0-9.^-]{1,15}"


def _clean_symbol(v):
    v = str(v or "").strip().upper()
    if not re.fullmatch(_SYM_RE, v):
        raise ValueError("kode/simbol tidak valid")
    return v


class WatchIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=15)

    @field_validator("symbol")
    @classmethod
    def _v_sym(cls, v):
        return _clean_symbol(v)


class TxnIn(BaseModel):
    date: str
    code: str = Field(min_length=1, max_length=15)
    type: str
    lot: int = Field(gt=0, le=1_000_000)
    price: float = Field(gt=0)
    fee: float = Field(default=0, ge=0)

    @field_validator("code")
    @classmethod
    def _v_code(cls, v):
        return _clean_symbol(v)

    @field_validator("type")
    @classmethod
    def _v_type(cls, v):
        v = str(v or "").strip().upper()
        if v not in ("BUY", "SELL"):
            raise ValueError("type harus BUY atau SELL")
        return v

    @field_validator("date")
    @classmethod
    def _v_date(cls, v):
        try:
            import pandas as pd
            pd.Timestamp(v)
        except Exception:
            raise ValueError("tanggal tidak valid")
        return v


class RuleIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=15)
    metric: str
    op: str
    value: str
    cooldown: int = Field(default=30, ge=0, le=10080)
    channels: list[str] = ["in-app"]

    @field_validator("symbol")
    @classmethod
    def _v_sym(cls, v):
        return _clean_symbol(v)

    @field_validator("value")
    @classmethod
    def _v_value(cls, v):
        s = str(v).replace(".", "").replace(",", ".").replace("−", "-").replace("–", "-")
        try:
            float(s)
        except (TypeError, ValueError):
            raise ValueError("nilai ambang harus angka")
        return v


class ToggleIn(BaseModel):
    active: bool


@app.post("/api/watchlist")
def add_watch(b: WatchIn):
    import storage
    storage.add_to_watchlist(utils.normalize_symbol(b.symbol))
    return {"ok": True}


@app.delete("/api/watchlist/{symbol}")
def del_watch(symbol: str):
    import storage
    storage.remove_from_watchlist(utils.normalize_symbol(symbol))
    return {"ok": True}


@app.get("/api/stocks")
def stocks_only():
    """Daftar watchlist (quote saja) — ringan & cepat untuk refresh instan setelah tambah/hapus."""
    import storage
    return JSONResponse(_jsonable({"STOCKS": build_stocks(storage.get_watchlist())}))


_KEY_FIELDS = ("GOAPI_KEY", "SECTORS_KEY", "TG_TOKEN", "TG_CHAT_ID")


class KeysIn(BaseModel):
    GOAPI_KEY: str | None = None
    SECTORS_KEY: str | None = None
    TG_TOKEN: str | None = None
    TG_CHAT_ID: str | None = None


def _keys_status():
    import storage
    return {k: bool((storage.kv_get(k) or "").strip()) for k in _KEY_FIELDS}


@app.get("/api/settings/keys")
def get_keys():
    """Status key (terisi/tidak) — nilai TIDAK pernah dikembalikan ke klien."""
    return _keys_status()


@app.post("/api/settings/keys")
def save_keys(b: KeysIn):
    """Simpan API key ke SQLite kv (lokal). Field kosong dibiarkan apa adanya."""
    import storage
    saved = []
    for k in _KEY_FIELDS:
        v = getattr(b, k, None)
        if v and str(v).strip():
            storage.kv_set(k, str(v).strip())
            saved.append(k)
    return {"ok": True, "saved": saved, "status": _keys_status(),
            "feed": "realtime" if ms.is_realtime() else "delayed"}


@app.post("/api/transactions")
def add_txn(b: TxnIn):
    import storage
    storage.add_transaction(_iso_date(b.date), utils.normalize_symbol(b.code),
                            b.type.upper(), int(b.lot), float(b.price), float(b.fee or 0))
    return {"ok": True}


@app.delete("/api/transactions/{tid}")
def del_txn(tid: int):
    import storage
    storage.delete_transaction(tid)
    return {"ok": True}


@app.post("/api/rules")
def add_rule(b: RuleIn):
    import storage
    metric = "price" if ("harga" in b.metric.lower() or b.metric == "price") else "change_pct"
    op = _OPMAP.get(b.op, ">=")
    sym = utils.normalize_symbol(b.symbol)
    name = f"{utils.short_code(sym)} {b.metric} {op} {b.value}"
    storage.add_rule(name, sym, metric, op, _num(b.value), int(b.cooldown or 30),
                     "+".join(b.channels) or "in-app")
    return {"ok": True}


@app.delete("/api/rules/{rid}")
def del_rule(rid: int):
    import storage
    storage.delete_rule(rid)
    return {"ok": True}


@app.post("/api/rules/{rid}/toggle")
def toggle_rule(rid: int, b: ToggleIn):
    import storage
    storage.toggle_rule(rid, b.active)
    return {"ok": True}


_UNIVERSE = None


def _dedup_universe(lst):
    seen, uniq = set(), []
    for it in sorted(lst, key=lambda x: x["code"]):
        if it["code"] not in seen:
            seen.add(it["code"])
            uniq.append(it)
    return uniq


@app.get("/api/universe")
def universe():
    """Daftar emiten IDX untuk autocomplete. Cache HANYA hasil GoAPI sukses;
    fallback KNOWN_NAMES TIDAK di-cache (supaya retry GoAPI saat kuota pulih)."""
    global _UNIVERSE
    if _UNIVERSE:
        return {"stocks": _UNIVERSE}
    items, key = [], get_key("GOAPI_KEY")
    if key:
        try:
            import requests
            r = requests.get("https://api.goapi.io/stock/idx/companies",
                             params={"api_key": key}, timeout=10)
            d = r.json()
            if isinstance(d, dict) and str(d.get("status")) == "success":
                for c in ((d.get("data") or {}).get("results") or []):
                    code = c.get("symbol") or c.get("code")
                    comp = c.get("company") if isinstance(c.get("company"), dict) else {}
                    name = (comp.get("name") if comp else None) or c.get("name") or code
                    if code:
                        items.append({"code": code, "name": name})
        except Exception:
            pass
    if items:  # GoAPI sukses → cache permanen
        _UNIVERSE = _dedup_universe(items)
        return {"stocks": _UNIVERSE}
    # fallback tanpa cache
    fallback = [{"code": k.replace(".JK", ""), "name": v}
                for k, v in config.KNOWN_NAMES.items() if not k.startswith("^")]
    return {"stocks": _dedup_universe(fallback)}


# Static React app (mount terakhir agar /api/* menang)
app.mount("/", StaticFiles(directory=WEBAPP, html=True), name="web")
