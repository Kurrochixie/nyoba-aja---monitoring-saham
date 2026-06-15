/* =========================================================================
   SAHAM MONITOR — Data visualisations (hand-built SVG)
   Sparkline · AreaChart · Donut · CandleChart(+SMA/Bollinger) · Volume · RSI · MACD
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var UP = "#16C784", DOWN = "#F6465D", FLAT = "#94A3B8";

  /* ---- measure hook ---- */
  function useMeasure() {
    var ref = React.useRef(null);
    var s = React.useState(0); var w = s[0], setW = s[1];
    React.useLayoutEffect(function () {
      if (!ref.current) return;
      var el = ref.current;
      var ro = new ResizeObserver(function (es) { for (var i = 0; i < es.length; i++) setW(es[i].contentRect.width); });
      ro.observe(el); setW(el.clientWidth);
      return function () { ro.disconnect(); };
    }, []);
    return [ref, w];
  }

  function smoothPath(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      var mx = (p0[0] + p1[0]) / 2;
      d += " C" + mx + " " + p0[1] + " " + mx + " " + p1[1] + " " + p1[0] + " " + p1[1];
    }
    return d;
  }

  /* =================== Sparkline (fixed size) =================== */
  function Sparkline(props) {
    var data = props.data || [];
    var W = props.width || 110, H = props.height || 34, pad = 3;
    var color = props.color || (data[data.length - 1] >= data[0] ? UP : DOWN);
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var rng = (max - min) || 1;
    var pts = data.map(function (v, i) {
      return [pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2), H - pad - ((v - min) / rng) * (H - pad * 2)];
    });
    var line = smoothPath(pts);
    var gid = "sg" + (props.id || Math.round(min));
    var areaD = line + " L" + pts[pts.length - 1][0] + " " + H + " L" + pts[0][0] + " " + H + " Z";
    return h("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, style: { display: "block" } },
      props.area !== false && h("defs", null, h("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        h("stop", { offset: "0%", stopColor: color, stopOpacity: 0.22 }),
        h("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }))),
      props.area !== false && h("path", { d: areaD, fill: "url(#" + gid + ")" }),
      h("path", { d: line, fill: "none", stroke: color, strokeWidth: props.sw || 1.8, strokeLinecap: "round", strokeLinejoin: "round" })
    );
  }

  /* =================== Area chart (measured, dates + hover) =================== */
  function AreaChart(props) {
    var m = useMeasure(); var ref = m[0], W = m[1];
    var data = props.data || [];
    var dates = props.dates;
    var interactive = props.axis || !!dates;
    var hov = React.useState(-1); var hi = hov[0], setHi = hov[1];
    var H = props.height || 90, padT = 10;
    var padB = (props.axis ? 18 : 8) + (dates ? 18 : 0);
    var padL = props.axis ? 8 : 0, padR = props.axis ? 10 : 0;
    var color = props.color || UP;
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var rng = (max - min) || 1; min -= rng * 0.08; max += rng * 0.08; rng = max - min;
    var iw = Math.max(10, W - padL - padR), ih = H - padT - padB;
    function X(i) { return padL + (i / Math.max(1, data.length - 1)) * iw; }
    function Y(v) { return padT + ih - ((v - min) / rng) * ih; }
    var pts = data.map(function (v, i) { return [X(i), Y(v)]; });
    var line = W ? smoothPath(pts) : "";
    var gid = "ag" + (props.id || "x");
    var areaD = line + " L" + (padL + iw) + " " + (padT + ih) + " L" + padL + " " + (padT + ih) + " Z";
    var grid = props.axis ? [0.25, 0.5, 0.75] : [];
    var vfmt = props.valueFmt || function (v) { return SM ? SM.fmt(Math.round(v)) : Math.round(v); };
    // date ticks
    var dticks = [];
    if (dates && data.length > 1) {
      var nT = Math.min(6, data.length);
      for (var t = 0; t < nT; t++) dticks.push(Math.round(t * (data.length - 1) / (nT - 1)));
    }
    function onMove(e) {
      if (!interactive || !W) return;
      var r = e.currentTarget.getBoundingClientRect();
      var idx = Math.round((e.clientX - r.left - padL) / iw * (data.length - 1));
      setHi(Math.max(0, Math.min(data.length - 1, idx)));
    }
    return h("div", { ref: ref, style: { width: "100%", height: H, position: "relative" } },
      W > 0 && h("svg", { width: W, height: H, style: { display: "block" }, onMouseMove: onMove, onMouseLeave: function () { setHi(-1); } },
        h("defs", null, h("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
          h("stop", { offset: "0%", stopColor: color, stopOpacity: 0.26 }),
          h("stop", { offset: "100%", stopColor: color, stopOpacity: 0.01 }))),
        grid.map(function (g, i) {
          var y = padT + ih * g;
          return h("line", { key: i, x1: padL, x2: padL + iw, y1: y, y2: y, stroke: "#EEF2F7", strokeWidth: 1 });
        }),
        h("path", { d: areaD, fill: "url(#" + gid + ")" }),
        h("path", { d: line, fill: "none", stroke: color, strokeWidth: props.sw || 2.4, strokeLinecap: "round", strokeLinejoin: "round" }),
        dticks.map(function (idx, i) {
          var anchor = i === 0 ? "start" : (i === dticks.length - 1 ? "end" : "middle");
          return h("text", { key: "d" + i, x: X(idx), y: H - 5, fontSize: 10.5, fill: "#94A3B8", textAnchor: anchor, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600 }, dates[idx].axis);
        }),
        hi >= 0 && h("line", { x1: X(hi), x2: X(hi), y1: padT, y2: padT + ih, stroke: "#B7C1D0", strokeWidth: 1, strokeDasharray: "3 3" }),
        (props.dot !== false && hi < 0 && pts.length > 0) && h("circle", { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3.5, fill: color, stroke: "#fff", strokeWidth: 2 }),
        hi >= 0 && h("circle", { cx: X(hi), cy: Y(data[hi]), r: 4.5, fill: color, stroke: "#fff", strokeWidth: 2.5 })
      ),
      hi >= 0 && dates && h("div", { style: { position: "absolute", top: 6, left: Math.min(Math.max(X(hi) - 64, 4), Math.max(4, W - 144)), background: "#fff", border: "1px solid #E9EDF2", borderRadius: 10, padding: "7px 11px", boxShadow: "0 10px 24px -8px rgba(15,23,42,0.2)", pointerEvents: "none", zIndex: 5, minWidth: 128 } },
        h("div", { style: { fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 3 } }, dates[hi].full),
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 7 } },
          h("span", { className: "num", style: { fontSize: 15, fontWeight: 800, color: color } }, vfmt(data[hi])),
          (function () { var b = data[0] || 1; var p = (data[hi] - b) / b * 100; return h("span", { className: "num", style: { fontSize: 12, fontWeight: 700, color: p >= 0 ? "var(--up-text)" : "var(--down-text)" } }, "(" + (p >= 0 ? "+" : "") + (SM ? SM.fmt(p, 2) : p.toFixed(2)) + "%)"); })()))
    );
  }

  /* =================== Donut =================== */
  function Donut(props) {
    var segs = props.data || [];
    var size = props.size || 200, sw = props.stroke || 26;
    var r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    var C = 2 * Math.PI * r;
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var off = 0;
    return h("div", { style: { position: "relative", width: size, height: size } },
      h("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, style: { transform: "rotate(-90deg)" } },
        h("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: "#EEF2F7", strokeWidth: sw }),
        segs.map(function (s, i) {
          var frac = s.value / total;
          var dash = frac * C;
          var el = h("circle", { key: i, cx: cx, cy: cy, r: r, fill: "none", stroke: s.color, strokeWidth: sw,
            strokeDasharray: dash + " " + (C - dash), strokeDashoffset: -off, strokeLinecap: "butt" });
          off += dash; return el;
        })
      ),
      props.center && h("div", { style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" } }, props.center)
    );
  }

  /* =================== Candlestick chart (measured, hover) =================== */
  function CandleChart(props) {
    var m = useMeasure(); var ref = m[0], W = m[1];
    var candles = props.candles || [];
    var H = props.height || 300;
    var dates = props.dates;
    var padT = 10, padB = dates ? 32 : 22, padL = 6, padR = 54;
    var hov = React.useState(-1); var hi = hov[0], setHi = hov[1];
    var overlays = props.overlays || []; // [{values,color,width,dash}]
    var bands = props.bands; // {upper:[],lower:[]}

    var lows = candles.map(function (c) { return c.l; });
    var highs = candles.map(function (c) { return c.h; });
    var min = Math.min.apply(null, lows), max = Math.max.apply(null, highs);
    if (bands) { min = Math.min(min, Math.min.apply(null, bands.lower)); max = Math.max(max, Math.max.apply(null, bands.upper)); }
    var rng = (max - min) || 1; min -= rng * 0.06; max += rng * 0.06; rng = max - min;
    var iw = Math.max(10, W - padL - padR), ih = H - padT - padB;
    var n = candles.length, step = iw / n;
    function X(i) { return padL + i * step + step / 2; }
    function Y(p) { return padT + ih - ((p - min) / rng) * ih; }
    var bw = Math.max(1.5, Math.min(step * 0.62, 14));

    function fmt(v) { return window.SM ? window.SM.fmt(v, v < 1000 ? 0 : 0) : Math.round(v); }
    var ticks = [0, 0.25, 0.5, 0.75, 1].map(function (g) { return min + rng * g; });

    function onMove(e) {
      var rect = e.currentTarget.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var idx = Math.round((x - padL - step / 2) / step);
      idx = Math.max(0, Math.min(n - 1, idx));
      setHi(idx);
    }

    var bandPath = null;
    if (bands && W) {
      var up = bands.upper.map(function (v, i) { return [X(i), Y(v)]; });
      var lo = bands.lower.map(function (v, i) { return [X(i), Y(v)]; });
      var d = "M" + up[0][0] + " " + up[0][1];
      for (var i = 1; i < up.length; i++) d += " L" + up[i][0] + " " + up[i][1];
      for (var j = lo.length - 1; j >= 0; j--) d += " L" + lo[j][0] + " " + lo[j][1];
      d += " Z"; bandPath = d;
    }

    return h("div", { ref: ref, style: { width: "100%", height: H, position: "relative" } },
      W > 0 && h("svg", { width: W, height: H, style: { display: "block" }, onMouseMove: onMove, onMouseLeave: function () { setHi(-1); } },
        ticks.map(function (t, i) {
          var y = Y(t);
          return h("g", { key: i },
            h("line", { x1: padL, x2: padL + iw, y1: y, y2: y, stroke: "#F0F3F7", strokeWidth: 1 }),
            h("text", { x: W - padR + 7, y: y + 3.5, fontSize: 10.5, fill: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }, fmt(t)));
        }),
        bandPath && h("path", { d: bandPath, fill: "rgba(79,102,232,0.07)", stroke: "none" }),
        bands && ["upper", "lower"].map(function (k, ki) {
          var pts = bands[k].map(function (v, i) { return X(i) + " " + Y(v); }).join(" L");
          return h("path", { key: ki, d: "M" + pts, fill: "none", stroke: "rgba(79,102,232,0.45)", strokeWidth: 1, strokeDasharray: "3 3" });
        }),
        candles.map(function (c, i) {
          var col = c.c >= c.o ? UP : DOWN;
          var x = X(i);
          var yo = Y(c.o), yc = Y(c.c);
          var top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
          return h("g", { key: i, opacity: hi === -1 || hi === i ? 1 : 0.82 },
            h("line", { x1: x, x2: x, y1: Y(c.h), y2: Y(c.l), stroke: col, strokeWidth: 1.2 }),
            h("rect", { x: x - bw / 2, y: top, width: bw, height: bh, fill: col, rx: 1 }));
        }),
        overlays.map(function (ov, oi) {
          var pts = ov.values.map(function (v, i) { return v == null ? null : (X(i) + " " + Y(v)); }).filter(Boolean);
          return h("path", { key: oi, d: "M" + pts.join(" L"), fill: "none", stroke: ov.color, strokeWidth: ov.width || 1.6, strokeDasharray: ov.dash || "none", opacity: 0.9 });
        }),
        hi >= 0 && h("line", { x1: X(hi), x2: X(hi), y1: padT, y2: padT + ih, stroke: "#B7C1D0", strokeWidth: 1, strokeDasharray: "3 3" }),
        dates && (function () {
          var nT = Math.min(6, candles.length), out = [];
          for (var t = 0; t < nT; t++) {
            var idx = Math.round(t * (candles.length - 1) / (nT - 1));
            var anchor = t === 0 ? "start" : (t === nT - 1 ? "end" : "middle");
            out.push(h("text", { key: "dt" + t, x: X(idx), y: H - 6, fontSize: 10.5, fill: "#94A3B8", textAnchor: anchor, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600 }, dates[idx].axis));
          }
          return out;
        })()
      ),
      hi >= 0 && candles[hi] && h(CandleTip, { c: candles[hi], x: X(hi), W: W, fmt: fmt, date: dates ? dates[hi].full : null, base: candles[0] ? candles[0].c : null })
    );
  }

  function CandleTip(props) {
    var c = props.c, fmt = props.fmt;
    var left = Math.min(Math.max(props.x - 70, 4), props.W - 150);
    var col = c.c >= c.o ? "#0E9C66" : "#E11D48";
    function row(l, v, cc) { return h("div", { style: { display: "flex", justifyContent: "space-between", gap: 14 } }, h("span", { style: { color: "#94A3B8" } }, l), h("span", { className: "num", style: { fontWeight: 700, color: cc || "#0F172A" } }, v)); }
    return h("div", { style: { position: "absolute", top: 6, left: left, background: "#fff", border: "1px solid #E9EDF2", borderRadius: 11, padding: "9px 12px", boxShadow: "0 10px 24px -8px rgba(15,23,42,0.2)", fontSize: 11.5, pointerEvents: "none", minWidth: 142, zIndex: 5 } },
      props.date && h("div", { style: { fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 5, paddingBottom: 5, borderBottom: "1px solid #F0F3F7" } }, props.date),
      row("Buka", fmt(c.o)), row("Tinggi", fmt(c.h), "#0E9C66"), row("Rendah", fmt(c.l), "#E11D48"), row("Tutup", fmt(c.c), col),
      props.base && (function () { var p = (c.c - props.base) / props.base * 100; return h("div", { style: { display: "flex", justifyContent: "space-between", gap: 14, marginTop: 4, paddingTop: 5, borderTop: "1px solid #F0F3F7" } }, h("span", { style: { color: "#94A3B8" } }, "Dari awal"), h("span", { className: "num", style: { fontWeight: 800, color: p >= 0 ? "#0E9C66" : "#E11D48" } }, (p >= 0 ? "+" : "") + (window.SM ? window.SM.fmt(p, 2) : p.toFixed(2)) + "%")); })());
  }

  /* =================== Volume panel =================== */
  function VolumePanel(props) {
    var m = useMeasure(); var ref = m[0], W = m[1];
    var candles = props.candles || [];
    var H = props.height || 70, padL = 6, padR = 54, padB = 4, padT = 6;
    var maxV = Math.max.apply(null, candles.map(function (c) { return c.v; })) || 1;
    var iw = Math.max(10, W - padL - padR), n = candles.length, step = iw / n;
    var bw = Math.max(1.5, Math.min(step * 0.62, 14));
    return h("div", { ref: ref, style: { width: "100%", height: H } },
      W > 0 && h("svg", { width: W, height: H, style: { display: "block" } },
        candles.map(function (c, i) {
          var col = c.c >= c.o ? "rgba(22,199,132,0.45)" : "rgba(246,70,93,0.45)";
          var bh = (c.v / maxV) * (H - padT - padB);
          var x = padL + i * step + step / 2;
          return h("rect", { key: i, x: x - bw / 2, y: H - padB - bh, width: bw, height: bh, fill: col, rx: 1 });
        }),
        h("text", { x: W - padR + 7, y: padT + 8, fontSize: 10, fill: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }, "Vol")
      )
    );
  }

  /* =================== RSI panel =================== */
  function RSIPanel(props) {
    var m = useMeasure(); var ref = m[0], W = m[1];
    var rsi = props.rsi || [];
    var H = props.height || 78, padL = 6, padR = 54, padT = 8, padB = 8;
    var iw = Math.max(10, W - padL - padR), ih = H - padT - padB, n = rsi.length;
    function X(i) { return padL + (i / (n - 1)) * iw; }
    function Y(v) { return padT + ih - (v / 100) * ih; }
    var pts = rsi.map(function (v, i) { return v == null ? null : (X(i) + " " + Y(v)); }).filter(Boolean);
    return h("div", { ref: ref, style: { width: "100%", height: H } },
      W > 0 && h("svg", { width: W, height: H, style: { display: "block" } },
        h("rect", { x: padL, y: Y(70), width: iw, height: Y(30) - Y(70), fill: "rgba(148,163,184,0.06)" }),
        [30, 50, 70].map(function (lv, i) {
          return h("g", { key: i }, h("line", { x1: padL, x2: padL + iw, y1: Y(lv), y2: Y(lv), stroke: lv === 50 ? "#EEF2F7" : "#E9EDF2", strokeWidth: 1, strokeDasharray: lv === 50 ? "none" : "3 3" }),
            h("text", { x: W - padR + 7, y: Y(lv) + 3, fontSize: 9.5, fill: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }, lv));
        }),
        h("path", { d: "M" + pts.join(" L"), fill: "none", stroke: "#7C5CF5", strokeWidth: 1.8 }),
        h("text", { x: padL + 2, y: padT + 9, fontSize: 10, fill: "#94A3B8", fontWeight: 700 }, "RSI 14")
      )
    );
  }

  /* =================== MACD panel =================== */
  function MACDPanel(props) {
    var m = useMeasure(); var ref = m[0], W = m[1];
    var d = props.data || { macd: [], signal: [], hist: [] };
    var H = props.height || 80, padL = 6, padR = 54, padT = 10, padB = 8;
    var all = d.macd.concat(d.signal).concat(d.hist);
    var mx = Math.max.apply(null, all.map(Math.abs)) || 1;
    var iw = Math.max(10, W - padL - padR), ih = H - padT - padB, n = d.macd.length;
    function X(i) { return padL + (i / (n - 1)) * iw; }
    function Y(v) { return padT + ih / 2 - (v / mx) * (ih / 2); }
    var bw = Math.max(1, iw / n * 0.6);
    function line(arr, col) { var pts = arr.map(function (v, i) { return X(i) + " " + Y(v); }); return h("path", { d: "M" + pts.join(" L"), fill: "none", stroke: col, strokeWidth: 1.6 }); }
    return h("div", { ref: ref, style: { width: "100%", height: H } },
      W > 0 && h("svg", { width: W, height: H, style: { display: "block" } },
        h("line", { x1: padL, x2: padL + iw, y1: Y(0), y2: Y(0), stroke: "#E9EDF2", strokeWidth: 1 }),
        d.hist.map(function (v, i) {
          var col = v >= 0 ? "rgba(22,199,132,0.55)" : "rgba(246,70,93,0.55)";
          var y0 = Y(0), y1 = Y(v);
          return h("rect", { key: i, x: X(i) - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)), fill: col });
        }),
        line(d.macd, "#4F66E8"), line(d.signal, "#E8A93C"),
        h("text", { x: padL + 2, y: padT + 6, fontSize: 10, fill: "#94A3B8", fontWeight: 700 }, "MACD 12,26,9")
      )
    );
  }

  /* =================== Widget TradingView (opsi sumber chart) =================== */
  function tvSymbol(code) {
    if (!code) return "IDX:COMPOSITE";
    var c = String(code).toUpperCase().replace(/\.JK$/, "").replace(/^\^/, "");
    if (c === "JKSE" || c === "IHSG" || c === "COMPOSITE") return "IDX:COMPOSITE";
    return "IDX:" + c;
  }

  function loadTV() {
    return new Promise(function (resolve, reject) {
      if (window.TradingView && window.TradingView.widget) { resolve(); return; }
      var s = document.getElementById("tv-js");
      if (s) { s.addEventListener("load", resolve); s.addEventListener("error", reject); return; }
      s = document.createElement("script");
      s.id = "tv-js"; s.src = "https://s3.tradingview.com/tv.js"; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var _tvSeq = 0;
  function TVChart(props) {
    var host = React.useRef(null);
    var idRef = React.useRef(null);
    if (!idRef.current) { _tvSeq += 1; idRef.current = "tvw_" + _tvSeq; }
    var es = React.useState(0); var err = es[0], setErr = es[1];
    var symbol = tvSymbol(props.code);
    var height = props.height || 440;
    React.useEffect(function () {
      var alive = true; setErr(0);
      loadTV().then(function () {
        if (!alive || !host.current) return;
        host.current.innerHTML = "";
        var inner = document.createElement("div");
        inner.id = idRef.current; inner.style.height = "100%"; inner.style.width = "100%";
        host.current.appendChild(inner);
        try {
          new window.TradingView.widget({
            autosize: true, symbol: symbol, interval: "D", timezone: "Asia/Jakarta",
            theme: "light", style: "1", locale: "id", hide_side_toolbar: false,
            allow_symbol_change: false, withdateranges: true, container_id: idRef.current,
            studies: ["MASimple@tv-basicstudies"]
          });
        } catch (e) { setErr(1); }
      }).catch(function () { if (alive) setErr(1); });
      return function () { alive = false; };
    }, [symbol]);
    if (err) {
      return h("div", { style: { height: height, display: "grid", placeItems: "center", textAlign: "center", padding: 24, border: "1px dashed var(--line)", borderRadius: 12, color: "var(--ink-3)", fontSize: 13 } },
        h("div", null,
          h("div", { style: { fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 } }, "Widget TradingView gagal dimuat"),
          "Periksa koneksi internet, atau gunakan chart Bawaan. Sebagian emiten IDX mungkin tak tersedia di TradingView."));
    }
    return h("div", { style: { position: "relative" } },
      h("div", { ref: host, style: { height: height, width: "100%" } }),
      h("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 } },
        "Sumber chart: TradingView · ", h("span", { className: "num" }, symbol), " (data delayed)"));
  }

  Object.assign(window, {
    Sparkline: Sparkline, AreaChart: AreaChart, Donut: Donut,
    CandleChart: CandleChart, VolumePanel: VolumePanel, RSIPanel: RSIPanel, MACDPanel: MACDPanel,
    TVChart: TVChart, tvSymbol: tvSymbol, useMeasure: useMeasure
  });
})();
