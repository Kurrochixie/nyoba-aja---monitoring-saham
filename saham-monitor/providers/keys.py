"""Ambil API key opsional: dari Pengaturan (SQLite kv) lalu .streamlit/secrets.toml."""
from __future__ import annotations


def get_key(name: str) -> str | None:
    import os
    v = os.environ.get(name)
    if v and v.strip():
        return v.strip()
    try:
        import storage
        v = storage.kv_get(name)
        if v and v.strip():
            return v.strip()
    except Exception:
        pass
    try:
        import streamlit as st
        if name in st.secrets:
            v = str(st.secrets[name]).strip()
            return v or None
    except Exception:
        pass
    return None
