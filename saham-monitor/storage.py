"""Penyimpanan durable (SQLite) — watchlist, meta, transaksi, rules, alert, kv."""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone

from cache import singleton

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS instrument_meta(
    symbol TEXT PRIMARY KEY, name TEXT, currency TEXT, exchange TEXT,
    sector TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS watchlist(symbol TEXT PRIMARY KEY, added_at TEXT);
CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, symbol TEXT, type TEXT,
    lots INTEGER, shares INTEGER, price REAL, fee REAL, notes TEXT);
CREATE TABLE IF NOT EXISTS snapshots(
    portfolio_id TEXT, date TEXT, total_value REAL, cost_basis REAL,
    pnl REAL, PRIMARY KEY(portfolio_id, date));
CREATE TABLE IF NOT EXISTS rules(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, symbol TEXT, metric TEXT,
    op TEXT, value REAL, cooldown_min INTEGER DEFAULT 30, channel TEXT,
    active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS rule_state(
    rule_id INTEGER PRIMARY KEY, armed INTEGER DEFAULT 1, last_fired REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS alert_events(
    id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id INTEGER, symbol TEXT,
    detail TEXT, fired_at TEXT, delivered INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS news_keywords(keyword TEXT PRIMARY KEY, added_at TEXT);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@singleton
def get_conn() -> sqlite3.Connection:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(config.CACHE_DIR, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    _seed_watchlist(conn)
    return conn


def _seed_watchlist(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) AS c FROM watchlist").fetchone()["c"] == 0:
        now = _now()
        conn.executemany("INSERT OR IGNORE INTO watchlist(symbol, added_at) VALUES(?, ?)",
                         [(s, now) for s in config.DEFAULT_WATCHLIST])
        conn.commit()


# ── Watchlist ───────────────────────────────────────────────────────────────
def get_watchlist() -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT symbol FROM watchlist ORDER BY (symbol LIKE '^%') DESC, symbol").fetchall()
    return [r["symbol"] for r in rows]


def add_to_watchlist(symbol: str) -> None:
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO watchlist(symbol, added_at) VALUES(?, ?)",
                 (symbol, _now()))
    conn.commit()


def remove_from_watchlist(symbol: str) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol,))
    conn.commit()


def in_watchlist(symbol: str) -> bool:
    return get_conn().execute("SELECT 1 FROM watchlist WHERE symbol = ?", (symbol,)).fetchone() is not None


# ── Kata kunci berita favorit ───────────────────────────────────────────────
def get_news_keywords() -> list[str]:
    rows = get_conn().execute(
        "SELECT keyword FROM news_keywords ORDER BY added_at").fetchall()
    return [r["keyword"] for r in rows]


def add_news_keyword(keyword: str) -> None:
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO news_keywords(keyword, added_at) VALUES(?, ?)",
                 (keyword.strip(), _now()))
    conn.commit()


def remove_news_keyword(keyword: str) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM news_keywords WHERE keyword = ?", (keyword,))
    conn.commit()


# ── Instrument meta ─────────────────────────────────────────────────────────
def upsert_meta(symbol: str, name: str = "", currency: str = "",
                sector: str = "", exchange: str = "") -> None:
    conn = get_conn()
    conn.execute(
        """INSERT INTO instrument_meta(symbol, name, currency, exchange, sector, updated_at)
           VALUES(?, ?, ?, ?, ?, ?)
           ON CONFLICT(symbol) DO UPDATE SET name=excluded.name, currency=excluded.currency,
             exchange=excluded.exchange, sector=excluded.sector, updated_at=excluded.updated_at""",
        (symbol, name, currency, exchange, sector, _now()))
    conn.commit()


def get_meta_name(symbol: str) -> str | None:
    row = get_conn().execute("SELECT name FROM instrument_meta WHERE symbol = ?", (symbol,)).fetchone()
    return row["name"] if row and row["name"] else None


# ── Transaksi portofolio ────────────────────────────────────────────────────
def add_transaction(date: str, symbol: str, type_: str, lots: int, price: float,
                    fee: float = 0.0, notes: str = "") -> None:
    conn = get_conn()
    conn.execute(
        "INSERT INTO transactions(date,symbol,type,lots,shares,price,fee,notes) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (date, symbol, type_, int(lots), int(lots) * config.LOT_SIZE, float(price),
         float(fee), notes))
    conn.commit()


def get_transactions() -> list[dict]:
    rows = get_conn().execute("SELECT * FROM transactions ORDER BY date, id").fetchall()
    return [dict(r) for r in rows]


def delete_transaction(txn_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM transactions WHERE id = ?", (txn_id,))
    conn.commit()


# ── Alert rules ─────────────────────────────────────────────────────────────
def add_rule(name: str, symbol: str, metric: str, op: str, value: float,
             cooldown_min: int = 30, channel: str = "app") -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO rules(name,symbol,metric,op,value,cooldown_min,channel,active,created_at) "
        "VALUES(?,?,?,?,?,?,?,1,?)",
        (name, symbol, metric, op, float(value), int(cooldown_min), channel, _now()))
    rid = cur.lastrowid
    conn.execute("INSERT OR REPLACE INTO rule_state(rule_id,armed,last_fired) VALUES(?,1,0)", (rid,))
    conn.commit()
    return rid


def get_rules(active_only: bool = False) -> list[dict]:
    q = "SELECT * FROM rules" + (" WHERE active=1" if active_only else "") + " ORDER BY id DESC"
    return [dict(r) for r in get_conn().execute(q).fetchall()]


def toggle_rule(rule_id: int, active: bool) -> None:
    conn = get_conn()
    conn.execute("UPDATE rules SET active=? WHERE id=?", (1 if active else 0, rule_id))
    conn.commit()


def delete_rule(rule_id: int) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM rules WHERE id=?", (rule_id,))
    conn.execute("DELETE FROM rule_state WHERE rule_id=?", (rule_id,))
    conn.commit()


def get_rule_state(rule_id: int) -> dict:
    row = get_conn().execute("SELECT * FROM rule_state WHERE rule_id=?", (rule_id,)).fetchone()
    return dict(row) if row else {"rule_id": rule_id, "armed": 1, "last_fired": 0.0}


def set_rule_state(rule_id: int, armed: int, last_fired: float) -> None:
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO rule_state(rule_id,armed,last_fired) VALUES(?,?,?)",
                 (rule_id, int(armed), float(last_fired)))
    conn.commit()


def add_alert_event(rule_id: int, symbol: str, detail: str) -> None:
    conn = get_conn()
    conn.execute("INSERT INTO alert_events(rule_id,symbol,detail,fired_at,delivered) VALUES(?,?,?,?,1)",
                 (rule_id, symbol, detail, _now()))
    conn.commit()


def get_alert_events(limit: int = 50) -> list[dict]:
    rows = get_conn().execute("SELECT * FROM alert_events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


# ── Key-value (preferensi & API key lokal) ──────────────────────────────────
def kv_get(key: str, default: str | None = None) -> str | None:
    row = get_conn().execute("SELECT v FROM kv WHERE k=?", (key,)).fetchone()
    return row["v"] if row else default


def kv_set(key: str, value: str) -> None:
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)", (key, value))
    conn.commit()
