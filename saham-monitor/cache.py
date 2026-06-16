"""Cache runtime-netral (TTL + singleton).

Pengganti st.cache_data / st.cache_resource agar lapisan service tidak bergantung
pada runtime Streamlit — dipakai juga oleh FastAPI (api.py) dan daemon. Thread-safe.
"""
from __future__ import annotations

import functools
import threading
import time


def ttl_cache(ttl: float):
    """Memoize hasil fungsi selama `ttl` detik. Key = (args, kwargs)."""
    def deco(fn):
        store: dict = {}
        lock = threading.Lock()

        @functools.wraps(fn)
        def wrapped(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            with lock:
                hit = store.get(key)
                if hit is not None and now - hit[0] < ttl:
                    return hit[1]
            val = fn(*args, **kwargs)
            with lock:
                store[key] = (now, val)
            return val

        def clear():
            with lock:
                store.clear()
        wrapped.clear = clear
        return wrapped
    return deco


def singleton(fn):
    """Cache satu instance seumur proses (pengganti st.cache_resource). Thread-safe."""
    holder: dict = {}
    lock = threading.Lock()

    @functools.wraps(fn)
    def wrapped(*args, **kwargs):
        with lock:
            if "v" not in holder:
                holder["v"] = fn(*args, **kwargs)
            return holder["v"]

    def clear():
        with lock:
            holder.clear()
    wrapped.clear = clear
    return wrapped
