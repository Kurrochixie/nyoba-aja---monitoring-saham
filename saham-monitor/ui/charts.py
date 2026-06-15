"""Chart: TradingView embed (premium) + Plotly candlestick (data lokal) + sparkline."""
from __future__ import annotations

import json

import pandas as pd
import plotly.graph_objects as go
import streamlit.components.v1 as components
from plotly.subplots import make_subplots

import utils

UP = "#16c784"
DOWN = "#f6465d"
GRID = "rgba(15,23,42,0.07)"
TV_BG = "rgba(255,255,255,1)"
AXIS = "#94a3b8"
TXT = "#52617a"


# ── TradingView embeds (gratis, via iframe) ─────────────────────────────────
def tv_ticker_tape(symbols: list[str], height: int = 84) -> None:
    """Ticker tape TradingView berjalan. symbols = list yfinance ('^JKSE','BBCA.JK')."""
    tv = [{"proName": utils.to_tv_symbol(s),
           "title": "IHSG" if s == "^JKSE" else s.replace(".JK", "")}
          for s in symbols]
    cfg = json.dumps({"symbols": tv, "showSymbolLogo": True, "isTransparent": True,
                      "displayMode": "adaptive", "colorTheme": "dark", "locale": "id"})
    components.html(
        '<div class="tradingview-widget-container">'
        '<div class="tradingview-widget-container__widget"></div>'
        '<script type="text/javascript" async '
        'src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js">'
        f'{cfg}</script></div>',
        height=height,
    )


def tv_advanced_chart(symbol: str, height: int = 520) -> None:
    """Advanced Real-Time Chart TradingView (dark, transparan, indikator built-in)."""
    cfg = json.dumps({
        "symbol": utils.to_tv_symbol(symbol), "interval": "D", "timezone": "Asia/Jakarta",
        "theme": "dark", "style": "1", "locale": "id", "isTransparent": True,
        "hide_top_toolbar": False, "allow_symbol_change": False,
        "width": "100%", "height": height,            # tinggi eksplisit (autosize collapse di iframe)
        "backgroundColor": TV_BG, "gridColor": "rgba(42,46,57,0.4)",
        "studies": ["STD;EMA"], "withdateranges": True,
    })
    components.html(
        f'<div class="tradingview-widget-container" style="height:{height}px;width:100%">'
        f'<div class="tradingview-widget-container__widget" style="height:{height}px;width:100%"></div>'
        '<script type="text/javascript" async '
        'src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js">'
        f'{cfg}</script></div>',
        height=height + 8,
    )


# ── Sparkline SVG (mini tren per baris watchlist) ───────────────────────────
def sparkline_svg(values: list[float], width: int = 110, height: int = 30) -> str:
    vals = [float(v) for v in values if v == v]  # buang NaN
    if len(vals) < 2:
        return ""
    lo, hi = min(vals), max(vals)
    rng = (hi - lo) or 1.0
    n = len(vals)
    pts = []
    for i, v in enumerate(vals):
        x = i / (n - 1) * (width - 2) + 1
        y = height - (v - lo) / rng * (height - 6) - 3
        pts.append(f"{x:.1f},{y:.1f}")
    up = vals[-1] >= vals[0]
    color = "#16c784" if up else "#f6465d"
    fill = "rgba(22,199,132,.14)" if up else "rgba(246,70,93,.12)"
    poly = " ".join(pts)
    area = f"1,{height} {poly} {width - 1},{height}"
    return (f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
            f'preserveAspectRatio="none" style="display:block">'
            f'<polygon points="{area}" fill="{fill}" stroke="none"/>'
            f'<polyline points="{poly}" fill="none" stroke="{color}" stroke-width="1.5" '
            f'stroke-linejoin="round" stroke-linecap="round"/></svg>')


# ── Plotly candlestick (data lokal yfinance) ────────────────────────────────
def candlestick(df: pd.DataFrame, *, show_volume: bool = True,
                hide_weekends: bool = True) -> go.Figure:
    df = df.copy()
    if show_volume and "Volume" in df.columns:
        fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                            vertical_spacing=0.03, row_heights=[0.78, 0.22])
    else:
        fig = make_subplots(rows=1, cols=1)
        show_volume = False

    fig.add_trace(go.Candlestick(
        x=df.index, open=df["Open"], high=df["High"], low=df["Low"], close=df["Close"],
        increasing_line_color=UP, decreasing_line_color=DOWN,
        increasing_fillcolor=UP, decreasing_fillcolor=DOWN,
        name="Harga", showlegend=False), row=1, col=1)

    if show_volume:
        colors = [UP if c >= o else DOWN for o, c in zip(df["Open"], df["Close"])]
        fig.add_trace(go.Bar(x=df.index, y=df["Volume"], marker_color=colors,
                             opacity=0.5, name="Volume", showlegend=False), row=2, col=1)

    fig.update_layout(
        template="plotly_white", height=540, margin=dict(l=8, r=8, t=24, b=8),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis_rangeslider_visible=False, hovermode="x unified", dragmode="pan",
        font=dict(family="Inter, sans-serif", size=12, color=TXT),
        hoverlabel=dict(bgcolor="#ffffff", bordercolor="#e9edf2",
                        font=dict(family="Inter", color="#0f172a")),
    )
    if hide_weekends:
        fig.update_xaxes(rangebreaks=[dict(bounds=["sat", "mon"])])
    fig.update_xaxes(showgrid=True, gridcolor=GRID,
                     tickfont=dict(family="Inter", size=11, color=AXIS))
    fig.update_yaxes(showgrid=True, gridcolor=GRID,
                     tickfont=dict(family="Inter", size=11, color=AXIS))
    return fig


def _base_layout(fig, height):
    fig.update_layout(
        template="plotly_white", height=height, margin=dict(l=8, r=8, t=24, b=8),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter, sans-serif", size=12, color=TXT),
        hoverlabel=dict(bgcolor="#ffffff", bordercolor="#e9edf2",
                        font=dict(family="Inter", color="#0f172a")),
    )
    fig.update_xaxes(showgrid=True, gridcolor=GRID,
                     tickfont=dict(family="Inter", size=10, color=AXIS))
    fig.update_yaxes(showgrid=True, gridcolor=GRID,
                     tickfont=dict(family="Inter", size=10, color=AXIS))
    return fig


def tech_chart(df, *, hide_weekends: bool = True):
    """Candlestick + SMA/BB overlay + Volume + RSI + MACD (multi-panel)."""
    fig = make_subplots(rows=4, cols=1, shared_xaxes=True, vertical_spacing=0.025,
                        row_heights=[0.5, 0.13, 0.19, 0.18])
    fig.add_trace(go.Candlestick(
        x=df.index, open=df["Open"], high=df["High"], low=df["Low"], close=df["Close"],
        increasing_line_color=UP, decreasing_line_color=DOWN,
        increasing_fillcolor=UP, decreasing_fillcolor=DOWN, name="Harga", showlegend=False),
        row=1, col=1)
    for col, color in (("SMA20", "#4d8dff"), ("SMA50", "#ff9f1c"), ("SMA200", "#b388ff")):
        if col in df:
            fig.add_trace(go.Scatter(x=df.index, y=df[col], line=dict(color=color, width=1.1),
                                     name=col), row=1, col=1)
    if "BB_high" in df:
        fig.add_trace(go.Scatter(x=df.index, y=df["BB_high"], line=dict(color="rgba(120,140,170,.4)", width=1),
                                 name="BB", showlegend=False), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["BB_low"], line=dict(color="rgba(120,140,170,.4)", width=1),
                                 fill="tonexty", fillcolor="rgba(120,140,170,.05)",
                                 name="BB", showlegend=False), row=1, col=1)
    if "Volume" in df:
        colors = [UP if c >= o else DOWN for o, c in zip(df["Open"], df["Close"])]
        fig.add_trace(go.Bar(x=df.index, y=df["Volume"], marker_color=colors, opacity=0.5,
                             showlegend=False), row=2, col=1)
    if "RSI" in df:
        fig.add_trace(go.Scatter(x=df.index, y=df["RSI"], line=dict(color="#ff9f1c", width=1.2),
                                 showlegend=False), row=3, col=1)
        fig.add_hline(y=70, line=dict(color=DOWN, width=0.7, dash="dot"), row=3, col=1)
        fig.add_hline(y=30, line=dict(color=UP, width=0.7, dash="dot"), row=3, col=1)
    if "MACD" in df:
        hist_colors = [UP if v >= 0 else DOWN for v in df["MACD_hist"].fillna(0)]
        fig.add_trace(go.Bar(x=df.index, y=df["MACD_hist"], marker_color=hist_colors, opacity=0.5,
                             showlegend=False), row=4, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["MACD"], line=dict(color="#4d8dff", width=1),
                                 showlegend=False), row=4, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["MACD_signal"], line=dict(color="#ff9f1c", width=1),
                                 showlegend=False), row=4, col=1)
    _base_layout(fig, 720)
    fig.update_layout(xaxis_rangeslider_visible=False, hovermode="x unified",
                      legend=dict(orientation="h", y=1.02, x=0, font=dict(size=10)))
    if hide_weekends:
        fig.update_xaxes(rangebreaks=[dict(bounds=["sat", "mon"])])
    fig.update_yaxes(title_text="RSI", row=3, col=1, range=[0, 100])
    fig.update_yaxes(title_text="MACD", row=4, col=1)
    return fig


def donut(labels, values):
    fig = go.Figure(go.Pie(
        labels=labels, values=values, hole=0.64, sort=False,
        marker=dict(colors=["#16c784", "#4d8dff", "#a78bfa", "#ff9f1c", "#f6465d",
                            "#22d3ee", "#fbbf24", "#94a3b8", "#fb7185", "#34d399"],
                    line=dict(color="#ffffff", width=2)),
        textinfo="label+percent", textfont=dict(family="Inter", size=11, color="#0f172a")))
    fig.update_layout(template="plotly_white", height=340, showlegend=False,
                      margin=dict(l=8, r=8, t=8, b=8),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
    return fig


def nav_line(series):
    up = series.iloc[-1] >= series.iloc[0]
    color = "#0ecb81" if up else "#f6465d"
    fill = "rgba(14,203,129,.12)" if up else "rgba(246,70,93,.12)"
    fig = go.Figure(go.Scatter(x=series.index, y=series.values, mode="lines",
                               line=dict(color=color, width=1.8), fill="tozeroy", fillcolor=fill,
                               name="NAV"))
    _base_layout(fig, 320)
    fig.update_yaxes(rangemode="normal")
    return fig
