"""Alert engine: evaluasi rule (edge-trigger + cooldown) + pengiriman notifikasi."""
from __future__ import annotations

import time

import requests

import storage
from providers.keys import get_key
from services import market_service as ms

METRICS = {"price": "Harga", "change_pct": "Perubahan %"}
OPS = (">=", "<=", ">", "<")


def _cmp(cur: float, op: str, val: float) -> bool:
    return {">=": cur >= val, "<=": cur <= val, ">": cur > val, "<": cur < val}.get(op, False)


def evaluate(quotes: dict | None = None) -> list[dict]:
    """Cek semua rule aktif. Fire bila kondisi terpenuhi, armed, & lewat cooldown.
    Edge-trigger: rule di-disarm setelah fire, re-arm saat kondisi tak lagi benar."""
    fired = []
    now = time.time()
    for r in storage.get_rules(active_only=True):
        sym = r["symbol"]
        q = (quotes or {}).get(sym) or ms.get_quote_obj(sym)
        if not q:
            continue
        cur = q.price if r["metric"] == "price" else q.change_pct
        cond = _cmp(cur, r["op"], r["value"])
        state = storage.get_rule_state(r["id"])
        cooldown = (r["cooldown_min"] or 0) * 60
        if cond and state["armed"] and (now - state["last_fired"]) >= cooldown:
            detail = (f"{ms.get_name(sym)} ({sym.replace('.JK','')}): "
                      f"{METRICS.get(r['metric'], r['metric'])} {cur:,.2f} {r['op']} {r['value']:,.2f}")
            storage.add_alert_event(r["id"], sym, detail)
            storage.set_rule_state(r["id"], armed=0, last_fired=now)
            _deliver(r, detail)
            fired.append({"rule": r, "detail": detail})
        elif not cond and not state["armed"]:
            storage.set_rule_state(r["id"], armed=1, last_fired=state["last_fired"])
    return fired


def _deliver(rule: dict, detail: str) -> None:
    channel = rule.get("channel", "app") or "app"
    if "telegram" in channel:
        send_telegram(detail)
    if "desktop" in channel:
        try:
            from plyer import notification
            notification.notify(title="Saham Monitor", message=detail, timeout=12)
        except Exception:
            pass


def send_telegram(text: str) -> bool:
    tok, chat = get_key("TG_TOKEN"), get_key("TG_CHAT_ID")
    if not tok or not chat:
        return False
    try:
        requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                      json={"chat_id": chat, "text": f"[Saham Monitor] {text}"}, timeout=8)
        return True
    except Exception:
        return False


def telegram_ready() -> bool:
    return bool(get_key("TG_TOKEN") and get_key("TG_CHAT_ID"))
