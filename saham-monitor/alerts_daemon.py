"""Daemon alert 24/7 — cek rule tanpa Streamlit terbuka.

Jalankan:  python alerts_daemon.py
Self-contained (sqlite + yfinance + requests + plyer); membaca rule & key dari
database app yang sama. Cocok dijadikan Windows Task Scheduler / service.
"""
from __future__ import annotations

import sqlite3
import time
from datetime import datetime, timezone

import requests
import yfinance as yf
from apscheduler.schedulers.blocking import BlockingScheduler

import config

CHECK_EVERY_SEC = 60


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _kv(c, k):
    r = c.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return r["v"] if r and r["v"] else None


def _quote(sym):
    try:
        fi = yf.Ticker(sym).fast_info
        return float(fi.last_price), float(fi.previous_close or 0)
    except Exception:
        return None, None


def _cmp(cur, op, val):
    return {">=": cur >= val, "<=": cur <= val, ">": cur > val, "<": cur < val}.get(op, False)


def _deliver(c, rule, detail):
    ch = rule["channel"] or "app"
    if "telegram" in ch:
        tok, chat = _kv(c, "TG_TOKEN"), _kv(c, "TG_CHAT_ID")
        if tok and chat:
            try:
                requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                              json={"chat_id": chat, "text": f"[Saham Monitor] {detail}"}, timeout=8)
            except Exception:
                pass
    if "desktop" in ch:
        try:
            from plyer import notification
            notification.notify(title="Saham Monitor", message=detail, timeout=12)
        except Exception:
            pass


def check():
    c = _conn()
    now = time.time()
    rules = c.execute("SELECT * FROM rules WHERE active=1").fetchall()
    for r in rules:
        price, prev = _quote(r["symbol"])
        if price is None:
            continue
        cur = price if r["metric"] == "price" else ((price - prev) / prev * 100 if prev else 0.0)
        cond = _cmp(cur, r["op"], r["value"])
        stt = c.execute("SELECT * FROM rule_state WHERE rule_id=?", (r["id"],)).fetchone()
        armed = stt["armed"] if stt else 1
        last = stt["last_fired"] if stt else 0.0
        cd = (r["cooldown_min"] or 0) * 60
        if cond and armed and (now - last) >= cd:
            detail = f"{r['symbol'].replace('.JK','')}: {r['metric']} {cur:,.2f} {r['op']} {r['value']:,.2f}"
            c.execute("INSERT INTO alert_events(rule_id,symbol,detail,fired_at,delivered) VALUES(?,?,?,?,1)",
                      (r["id"], r["symbol"], detail, datetime.now(timezone.utc).isoformat()))
            c.execute("INSERT OR REPLACE INTO rule_state(rule_id,armed,last_fired) VALUES(?,0,?)",
                      (r["id"], now))
            c.commit()
            _deliver(c, r, detail)
            print(f"[{datetime.now():%H:%M:%S}] FIRED  {detail}")
        elif not cond and not armed:
            c.execute("INSERT OR REPLACE INTO rule_state(rule_id,armed,last_fired) VALUES(?,1,?)",
                      (r["id"], last))
            c.commit()
    c.close()


if __name__ == "__main__":
    print(f"Saham Monitor alert daemon — cek tiap {CHECK_EVERY_SEC}s. Ctrl+C untuk berhenti.")
    check()
    sched = BlockingScheduler(timezone="Asia/Jakarta")
    sched.add_job(check, "interval", seconds=CHECK_EVERY_SEC)
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        print("Daemon berhenti.")
