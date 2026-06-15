"""Berita: ambil RSS (Google News + outlet ID), parsing, sentimen leksikon ID."""
from __future__ import annotations

import re
import time
from urllib.parse import quote_plus

import feedparser
import requests
import streamlit as st

import config

_HEADERS = {"User-Agent": "Mozilla/5.0 (SahamMonitor/1.0)"}

_WORD = re.compile(r"[a-zA-ZÀ-ÿ]+")


def score_sentiment(text: str) -> tuple[int, str]:
    """Return (skor, label). Leksikon Bahasa Indonesia ringan."""
    words = [w.lower() for w in _WORD.findall(text or "")]
    pos = sum(1 for w in words if w in config.POS_WORDS)
    neg = sum(1 for w in words if w in config.NEG_WORDS)
    score = pos - neg
    label = "positif" if score > 0 else "negatif" if score < 0 else "netral"
    return score, label


def _clean(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()


def _epoch(entry) -> float:
    t = entry.get("published_parsed") or entry.get("updated_parsed")
    try:
        return time.mktime(t) if t else 0.0
    except Exception:
        return 0.0


def _real_source(entry, fallback: str) -> str:
    """Penerbit asli: Google News menaruh <source>Penerbit</source> per item.
    Outlet RSS langsung (Detik/CNBC) tak punya itu → pakai nama feed."""
    src = entry.get("source")
    if isinstance(src, dict):
        name = (src.get("title") or "").strip()
        if name:
            return name
    return fallback


def _parse(url: str, source: str) -> list[dict]:
    out = []
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=8)
        feed = feedparser.parse(resp.content)
        for e in feed.entries:
            title = _clean(e.get("title", ""))
            if not title:
                continue
            src = _real_source(e, source)
            # Google News menambah " - <Penerbit>" di akhir judul → rapikan
            if src and title.endswith(" - " + src):
                title = title[: -(len(src) + 3)].rstrip()
            summary = _clean(e.get("summary", ""))[:240]
            # Skor sentimen dari judul + ringkasan (lebih banyak sinyal).
            score, label = score_sentiment(title + " " + summary)
            out.append({
                "title": title, "link": e.get("link", ""),
                "source": src, "ts": _epoch(e),
                "summary": summary,
                "score": score, "sentiment": label,
            })
    except Exception:
        pass
    return out


def _dedup_sort(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for it in sorted(items, key=lambda x: x["ts"], reverse=True):
        k = it["title"][:80].lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


@st.cache_data(ttl=config.TTL_NEWS, show_spinner=False)
def fetch_general(limit: int = 40) -> list[dict]:
    items = []
    for name, url in config.NEWS_FEEDS_GENERAL.items():
        items += _parse(url, name)
    return _dedup_sort(items)[:limit]


@st.cache_data(ttl=config.TTL_NEWS, show_spinner=False)
def fetch_for_query(query: str, limit: int = 25) -> list[dict]:
    url = config.GOOGLE_NEWS.format(q=quote_plus(query))
    return _dedup_sort(_parse(url, "Google News"))[:limit]


def sentiment_rollup(items: list[dict]) -> dict:
    pos = sum(1 for i in items if i["sentiment"] == "positif")
    neg = sum(1 for i in items if i["sentiment"] == "negatif")
    net = len(items) - pos - neg
    return {"pos": pos, "neg": neg, "net": net, "total": len(items)}
