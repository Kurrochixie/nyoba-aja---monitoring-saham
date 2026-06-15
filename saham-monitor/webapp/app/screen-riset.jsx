/* =========================================================================
   SAHAM MONITOR — Riset Saham
   Tab: Ringkasan · Laporan Keuangan · Fundamental · Analisis Teknikal · Berita
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect;

  var PERIODS = [
    { id: "1B", n: 22, v: 0.016, label: "1 Bulan" }, { id: "3B", n: 66, v: 0.02, label: "3 Bulan" },
    { id: "6B", n: 130, v: 0.024, label: "6 Bulan" }, { id: "1T", n: 250, v: 0.028, label: "1 Tahun" },
    { id: "3T", n: 360, v: 0.032, label: "3 Tahun" }, { id: "5T", n: 460, v: 0.036, label: "5 Tahun" }
  ];

  /* ---------- analytics helpers ---------- */
  function bollinger(closes, period, k) {
    period = period || 20; k = k || 2;
    var mid = SM.sma(closes, period), upper = [], lower = [];
    for (var i = 0; i < closes.length; i++) {
      if (mid[i] == null) { upper.push(null); lower.push(null); continue; }
      var s = 0; for (var j = i - period + 1; j <= i; j++) s += Math.pow(closes[j] - mid[i], 2);
      var sd = Math.sqrt(s / period);
      upper.push(mid[i] + k * sd); lower.push(mid[i] - k * sd);
    }
    var fu = upper[period], fl = lower[period], fm = mid[period];
    for (var x = 0; x < period; x++) { upper[x] = fu; lower[x] = fl; mid[x] = fm; }
    return { upper: upper, lower: lower, mid: mid };
  }
  function resample(candles, f) {
    if (f <= 1) return candles;
    var out = [];
    for (var i = 0; i < candles.length; i += f) {
      var g = candles.slice(i, i + f); if (!g.length) break;
      out.push({ o: g[0].o, c: g[g.length - 1].c, h: Math.max.apply(null, g.map(function (x) { return x.h; })), l: Math.min.apply(null, g.map(function (x) { return x.l; })), v: g.reduce(function (a, x) { return a + x.v; }, 0) });
    }
    return out;
  }

  function buildConsensus(s, R) {
    var seed = s.seed;
    var bull = R.verdict === "BULLISH", bear = R.verdict === "BEARISH";
    var total = 12 + (seed % 9);
    var buy = Math.round(total * (bull ? 0.62 : bear ? 0.18 : 0.42));
    var sell = Math.round(total * (bear ? 0.5 : bull ? 0.08 : 0.16));
    var hold = Math.max(0, total - buy - sell);
    var label = (buy / total > 0.55) ? "Beli Kuat" : (buy / total > 0.4) ? "Beli" : (sell / total > 0.4) ? "Jual" : "Tahan";
    var price = R.price;
    var targetAvg = Math.round(price * (bull ? 1.18 : bear ? 0.93 : 1.06));
    var targetLow = Math.round(price * (bear ? 0.8 : 0.9));
    var targetHigh = Math.round(price * (bull ? 1.4 : 1.18));
    return { total: total, buy: buy, hold: hold, sell: sell, label: label, targetLow: targetLow, targetAvg: targetAvg, targetHigh: targetHigh, upside: (targetAvg - price) / price * 100 };
  }

  function buildFinancials(s, R) {
    var seed = s.seed;
    var baseRev = 2000 + (seed % 30) * 360;       // miliar
    var margin = 0.08 + (seed % 12) / 100;
    var labels = ["Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25", "Q1 '26"];
    var bias = R.verdict === "BULLISH" ? 1.06 : R.verdict === "BEARISH" ? 0.965 : 1.015;
    var rev = baseRev, arr = [];
    for (var i = 0; i < labels.length; i++) {
      var rr = Math.round(rev * (0.92 + ((seed * (i + 3)) % 18) / 100));
      var np = Math.round(rr * margin * (0.8 + ((seed * (i + 1)) % 34) / 100));
      arr.push({ label: labels[i], revenue: rr, profit: np });
      rev = rev * bias;
    }
    var revYoY = (arr[4].revenue - arr[0].revenue) / arr[0].revenue * 100;
    var profitYoY = (arr[4].profit - arr[0].profit) / arr[0].profit * 100;
    function T(v) { return "Rp " + SM.fmt(v / 1000, 2) + " T"; }
    var annualRev = arr.reduce(function (a, x) { return a + x.revenue; }, 0);
    var annualNp = arr.reduce(function (a, x) { return a + x.profit; }, 0);
    var lines = [
      { name: "Pendapatan", value: T(annualRev), yoy: revYoY },
      { name: "Laba Kotor", value: T(annualRev * 0.34), yoy: revYoY * 0.92 },
      { name: "Laba Usaha", value: T(annualRev * 0.2), yoy: profitYoY * 0.95 },
      { name: "Laba Bersih", value: T(annualNp), yoy: profitYoY },
      { name: "Total Aset", value: T(annualRev * 2.4), yoy: 6 + (seed % 8) },
      { name: "Ekuitas", value: T(annualRev * 1.3), yoy: 5 + (seed % 7) },
      { name: "Liabilitas", value: T(annualRev * 1.1), yoy: 3 + (seed % 6) },
      { name: "Arus Kas Operasi", value: T(annualRev * 0.22), yoy: profitYoY * 0.8 }
    ];
    return { quarters: arr, revYoY: revYoY, profitYoY: profitYoY, lines: lines, margin: margin * 100, period: "TTM · 5 kuartal terakhir" };
  }

  function buildResearch(code) {
    var s = SM.getStock(code) || SM.STOCKS[0];
    var base;
    if (SM.RESEARCH[code]) base = Object.assign({}, SM.RESEARCH[code]);
    else {
      var seed = s.seed;
      var perN = (8 + (seed % 12)) + (seed % 7) / 10;
      var rsiV = 38 + (seed * 7) % 40;
      base = {
        code: s.code, name: s.name + " Tbk", sector: s.sector, industry: s.sector,
        price: s.price, chg: s.chg, chgPct: s.chgPct,
        high: Math.round(s.price * 1.012), low: Math.round(s.price * 0.985), open: s.prevClose, vol: s.vol,
        mcap: (10 + seed % 90) + ",1 T", per: perN.toFixed(2) + "x", pbv: (1 + (seed % 30) / 10).toFixed(2) + "x",
        divYield: (1 + (seed % 50) / 10).toFixed(2) + "%", eps: SM.fmt(Math.round(s.price / perN)),
        bookValue: SM.fmt(Math.round(s.price / (1 + (seed % 30) / 10))), roe: (8 + seed % 18) + ",0%",
        netMargin: (5 + seed % 25) + ",0%", der: (0.2 + (seed % 12) / 10).toFixed(2) + "x", beta: (0.8 + (seed % 10) / 10).toFixed(2),
        w52low: Math.round(s.price * 0.7), w52high: Math.round(s.price * 1.5),
        rsi: rsiV, rsiState: rsiV > 70 ? "Overbought" : (rsiV < 30 ? "Oversold" : "Netral"),
        verdict: s.chgPct > 4 ? "BULLISH" : (s.chgPct < 0 ? "BEARISH" : "NETRAL"),
        signals: [
          { name: "RSI(14)", value: String(rsiV), state: rsiV > 70 ? "neg" : (rsiV < 30 ? "pos" : "neu"), note: "Momentum" },
          { name: "Harga vs SMA50", value: s.chgPct > 0 ? "Di atas" : "Di bawah", state: s.chgPct > 0 ? "pos" : "neg", note: "Tren menengah" },
          { name: "SMA50 vs SMA200", value: "Golden Cross", state: "pos", note: "Tren panjang" },
          { name: "MACD", value: s.chgPct >= 0 ? "Bullish" : "Bearish", state: s.chgPct >= 0 ? "pos" : "neg", note: "Histogram" }
        ]
      };
    }
    base.consensus = buildConsensus(s, base);
    base.financials = buildFinancials(s, base);
    // news sentiment counts (deterministic)
    var sd = s.seed;
    base.sentiment = { pos: 3 + sd % 6, neg: sd % 3, neu: 4 + sd % 5 };
    return base;
  }

  /* ===================== Riset shell ===================== */
  function Riset(props) {
    var ts = useState("ringkasan"); var tab = ts[0], setTab = ts[1];
    var code = props.selected || "ANTM";
    var R = buildResearch(code);
    var s = SM.getStock(code) || SM.STOCKS[0];

    var TABS = [
      { id: "ringkasan", label: "Ringkasan", ic: "activity" },
      { id: "keuangan", label: "Laporan Keuangan", ic: "coins" },
      { id: "fundamental", label: "Fundamental", ic: "barChart" },
      { id: "teknikal", label: "Analisis Teknikal", ic: "candlestick" },
      { id: "berita", label: "Berita", ic: "newspaper" }
    ];

    return h("div", { className: "screen" },
      h("div", { className: "card", style: { marginBottom: 14, padding: "12px 16px" } },
        h(window.EmitenSelector, { label: "Pilih emiten", selected: code, onSelect: props.onSelect })),
      h("div", { className: "card", style: { marginBottom: 18 } },
        h("div", { className: "card-pad", style: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" } },
          h(window.StockBadge, { code: R.code, color: s.color, logo: s.logo, domain: s.domain, size: 52 }),
          h("div", null,
            h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
              h("span", { style: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" } }, R.code),
              h("span", { className: "badge accent" }, R.sector)),
            h("div", { style: { color: "var(--ink-2)", fontSize: 14, marginTop: 2 } }, R.name)),
          h("div", { style: { marginLeft: "auto", textAlign: "right" } },
            h("div", { className: "num", style: { fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" } }, SM.fmt(R.price)),
            h("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 2 } }, h(window.Delta, { pct: R.chgPct, chg: R.chg, size: "lg" })))),
        h("div", { style: { padding: "0 20px", overflowX: "auto" } },
          h("div", { className: "tabs", style: { minWidth: "max-content" } }, TABS.map(function (t) {
            return h("button", { key: t.id, className: "tab" + (tab === t.id ? " active" : ""), onClick: function () { setTab(t.id); } },
              h("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" } }, h(Ic, { name: t.ic, size: 15 }), t.label));
          })))),

      tab === "ringkasan" && h(RingkasanTab, { R: R, s: s }),
      tab === "keuangan" && h(KeuanganTab, { R: R }),
      tab === "fundamental" && h(FundamentalTab, { R: R }),
      tab === "teknikal" && h(TeknikalTab, { R: R, s: s }),
      tab === "berita" && h(BeritaTab, { R: R })
    );
  }

  /* ===================== Decision strip ===================== */
  function DecisionStrip(R) {
    var c = R.consensus, sent = R.sentiment;
    var vClass = R.verdict === "BULLISH" ? "pos" : (R.verdict === "BEARISH" ? "neg" : "neu");
    var sentNet = sent.pos - sent.neg;
    var sentLabel = sentNet > 1 ? "Positif" : (sentNet < 0 ? "Negatif" : "Netral");
    var sentClass = sentNet > 1 ? "pos" : (sentNet < 0 ? "neg" : "neu");
    var conClass = /Beli/.test(c.label) ? "pos" : (c.label === "Jual" ? "neg" : "neu");
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 18 } },
      decCard("candlestick", "Sinyal Teknikal", R.verdict, vClass, R.verdict === "BULLISH" ? "Tren menguat" : R.verdict === "BEARISH" ? "Tren melemah" : "Sinyal tercampur"),
      decCard("sparkles", "Sentimen Berita", sentLabel, sentClass, sent.pos + " positif · " + sent.neg + " negatif · " + sent.neu + " netral"),
      decCard("gauge", "Konsensus Analis", c.label, conClass, (c.upside >= 0 ? "Potensi +" : "Potensi ") + SM.fmt(c.upside, 1) + "% ke target")
    );
  }
  function decCard(ic, label, value, cls, sub) {
    var col = cls === "pos" ? "var(--up-text)" : (cls === "neg" ? "var(--down-text)" : "var(--ink)");
    var bg = cls === "pos" ? "var(--up-soft)" : (cls === "neg" ? "var(--down-soft)" : "var(--surface-3)");
    return h("div", { className: "card card-pad", style: { display: "flex", alignItems: "center", gap: 13 } },
      h("div", { style: { width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: bg, color: col, flexShrink: 0 } }, h(Ic, { name: ic, size: 21 })),
      h("div", { style: { minWidth: 0 } },
        h("div", { className: "eyebrow", style: { marginBottom: 3 } }, label),
        h("div", { style: { fontSize: 17, fontWeight: 800, color: col, lineHeight: 1.1 } }, value),
        h("div", { style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } }, sub)));
  }

  /* ===================== Ringkasan tab ===================== */
  function RingkasanTab(props) {
    var R = props.R, s = props.s;
    var ps = useState("6B"); var period = ps[0], setPeriod = ps[1];
    var is = useState("Harian"); var intv = is[0], setIntv = is[1];
    var cs = useState("Garis"); var ctype = cs[0], setCtype = cs[1];
    var cms = useState("builtin"); var chartMode = cms[0], setChartMode = cms[1];
    var idd = useState(null); var intra = idd[0], setIntra = idd[1];

    var isIntra = intv === "5m" || intv === "15m";

    /* Intraday: tarik candle NYATA dari API (yfinance) saat interval 5m/15m. */
    useEffect(function () {
      if (!isIntra) { setIntra(null); return; }
      var alive = true; setIntra({ loading: true });
      var range = intv === "5m" ? "1H" : "5H";
      fetch("/api/candles?code=" + encodeURIComponent(R.code) + "&range=" + range)
        .then(function (r) { return r.json(); })
        .then(function (d) { if (alive) setIntra(d && d.ok && d.candles && d.candles.length ? d : { empty: true }); })
        .catch(function () { if (alive) setIntra({ empty: true }); });
      return function () { alive = false; };
    }, [R.code, intv]);

    var pcfg = PERIODS.filter(function (p) { return p.id === period; })[0];
    var rawFactor = intv === "Mingguan" ? 5 : (intv === "Bulanan" ? 22 : 1);
    var factor = Math.min(rawFactor, Math.max(1, Math.floor(pcfg.n / 6)));
    var seedCandles = useMemo(function () {
      return resample(SM.genCandles(s.seed * 5 + pcfg.n, pcfg.n, R.price, pcfg.v), factor);
    }, [R.code, period, intv]);
    var seedDates = useMemo(function () { return SM.genDates(seedCandles.length, isIntra ? "Harian" : intv); }, [R.code, period, intv]);

    var candles = isIntra ? ((intra && intra.candles) || []) : seedCandles;
    var dates = isIntra ? ((intra && intra.dates) || []) : seedDates;
    var closes = candles.map(function (c) { return c.c; });
    var col = R.chgPct >= 0 ? "#16C784" : "#F6465D";
    var rangePos = (R.price - R.w52low) / (R.w52high - R.w52low) * 100;
    var INTERVALS = ["5m", "15m", "Harian", "Mingguan", "Bulanan"];

    var chartBody;
    if (isIntra && intra && intra.loading) {
      chartBody = h("div", { style: { height: 300, display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13 } }, "Memuat data intraday…");
    } else if (isIntra && intra && intra.empty) {
      chartBody = h("div", { style: { height: 300, display: "grid", placeItems: "center", textAlign: "center", padding: 24, border: "1px dashed var(--line)", borderRadius: 12, color: "var(--ink-3)", fontSize: 13 } },
        h("div", null, h("div", { style: { fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 } }, "Data intraday belum tersedia"), "Tersedia saat jam bursa untuk emiten likuid. Coba interval Harian."));
    } else {
      chartBody = ctype === "Candle"
        ? h(window.CandleChart, { candles: candles, dates: dates, height: 300, overlays: closes.length > 20 ? [{ values: SM.sma(closes, 20), color: "#4F66E8", width: 1.5 }] : [] })
        : h(window.AreaChart, { data: closes, dates: dates, height: 280, color: col, axis: true, id: "rk" + period + intv });
    }

    return h("div", { className: "screen" },
      DecisionStrip(R),
      h("div", { className: "ringkasan-grid" },
        h("div", { className: "grid", style: { gap: 18 } },
          /* chart card with controls */
          h("div", { className: "card" },
            h("div", { className: "card-head", style: { flexWrap: "wrap", rowGap: 10 } },
              h(Ic, { name: "candlestick", size: 18 }),
              h("div", null, h("div", { className: "ttl" }, "Pergerakan Harga"), h("div", { className: "sub" }, chartMode === "tv" ? "via TradingView" : (isIntra ? ("Intraday · " + intv + " (data nyata)") : (pcfg.label + " · " + intv)))),
              h("div", { className: "spacer" }),
              h("div", { className: "segmented" }, [["builtin", "Bawaan"], ["tv", "TradingView"]].map(function (m) {
                return h("button", { key: m[0], className: chartMode === m[0] ? "active" : "", onClick: function () { setChartMode(m[0]); } }, m[1]);
              })),
              chartMode === "builtin" ? h("div", { className: "segmented", style: { marginLeft: 8 } }, ["Garis", "Candle"].map(function (t) {
                return h("button", { key: t, className: ctype === t ? "active" : "", onClick: function () { setCtype(t); } }, t);
              })) : null),
            h("div", { className: "card-pad", style: { paddingTop: 14 } },
              chartMode === "tv"
                ? h(window.TVChart, { code: R.code, height: 420 })
                : h(React.Fragment, null,
                    h("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, alignItems: "center" } },
                      (!isIntra) ? ctrl("Rentang", h("div", { className: "segmented" }, PERIODS.map(function (p) {
                        return h("button", { key: p.id, className: period === p.id ? "active" : "", onClick: function () { setPeriod(p.id); } }, p.id);
                      }))) : null,
                      ctrl("Interval", h("div", { className: "segmented" }, INTERVALS.map(function (iv) {
                        return h("button", { key: iv, className: intv === iv ? "active" : "", onClick: function () { setIntv(iv); } }, iv);
                      })))),
                    chartBody))),
          /* price & trading */
          h("div", { className: "card card-pad" },
            h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "activity", size: 16 }), "Harga & Perdagangan"),
            h("div", { className: "metric-row", style: { gridTemplateColumns: "repeat(4,1fr)" } },
              mcell("Harga", SM.fmt(R.price)), mcell("Tertinggi", SM.fmt(R.high), "up"),
              mcell("Terendah", SM.fmt(R.low), "down"), mcell("Volume", R.vol))),
          /* 52 week */
          h("div", { className: "card card-pad" },
            h("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 10 } },
              h("div", { className: "section-title" }, h(Ic, { name: "target", size: 16 }), "Rentang 52 Minggu"),
              h("div", { className: "num", style: { fontSize: 13, color: "var(--ink-2)", fontWeight: 600 } }, SM.fmt(R.w52low) + " – " + SM.fmt(R.w52high))),
            h("div", { style: { position: "relative", height: 10, background: "linear-gradient(90deg,#F6465D,#E8A93C,#16C784)", borderRadius: 99, opacity: 0.85 } },
              h("div", { style: { position: "absolute", top: -4, left: "calc(" + Math.max(2, Math.min(98, rangePos)) + "% - 9px)", width: 18, height: 18, borderRadius: 99, background: "#fff", border: "3px solid var(--ink)", boxShadow: "var(--sh-sm)" } })),
            h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 } },
              h("span", null, "Terendah 52M"), h("span", null, "Tertinggi 52M")))),
        /* right column */
        h("div", { className: "grid", style: { gap: 18, height: "fit-content" } },
          h("div", { className: "card card-pad" },
            h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "coins", size: 16 }), "Valuasi"),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
              valRow("Kapitalisasi Pasar", "Rp " + R.mcap), valRow("PER (Price/Earnings)", R.per),
              valRow("PBV (Price/Book)", R.pbv), valRow("Dividend Yield", R.divYield, "up"),
              valRow("EPS", "Rp " + R.eps), valRow("Sektor", R.sector))),
          ConsensusCard(R)))
    );
  }

  /* ===================== Konsensus & Prediksi card ===================== */
  function ConsensusCard(R) {
    var c = R.consensus;
    var up = c.upside >= 0;
    var lo = c.targetLow, hi = c.targetHigh;
    function pos(v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)); }
    var labelClass = /Beli/.test(c.label) ? "pos" : (c.label === "Jual" ? "neg" : "neu");
    return h("div", { className: "card card-pad" },
      h("div", { style: { display: "flex", alignItems: "center", marginBottom: 14 } },
        h("div", { className: "section-title" }, h(Ic, { name: "gauge", size: 16 }), "Konsensus & Prediksi"),
        h("span", { className: "badge " + labelClass, style: { marginLeft: "auto" } }, c.label)),
      /* rating distribution */
      h("div", { className: "progress", style: { height: 10, marginBottom: 10 } },
        h("span", { style: { width: (c.buy / c.total * 100) + "%", background: "var(--up)" } }),
        h("span", { style: { width: (c.hold / c.total * 100) + "%", background: "var(--ink-4)" } }),
        h("span", { style: { width: (c.sell / c.total * 100) + "%", background: "var(--down)" } })),
      h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 18 } },
        ratingLeg("Beli", c.buy, "var(--up-text)"), ratingLeg("Tahan", c.hold, "var(--ink-2)"), ratingLeg("Jual", c.sell, "var(--down-text)"),
        h("span", { style: { color: "var(--ink-3)", fontWeight: 600 } }, c.total + " analis")),
      /* target price */
      h("div", { className: "eyebrow", style: { marginBottom: 8 } }, "Target Harga 12 Bulan"),
      h("div", { style: { position: "relative", height: 8, background: "var(--surface-3)", borderRadius: 99, marginBottom: 4 } },
        h("div", { style: { position: "absolute", left: pos(R.price) + "%", right: (100 - pos(c.targetAvg)) + "%", top: 0, height: "100%", background: up ? "var(--up)" : "var(--down)", borderRadius: 99, opacity: 0.5 } }),
        marker(pos(R.price), "var(--ink)", "Kini"), marker(pos(c.targetAvg), up ? "var(--up)" : "var(--down)", "Avg")),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 16, marginBottom: 14 } },
        tgt("Terendah", c.targetLow), tgt("Rata-rata", c.targetAvg, up ? "up" : "down"), tgt("Tertinggi", c.targetHigh)),
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 11, background: up ? "var(--up-soft)" : "var(--down-soft)", marginBottom: 12 } },
        h(Ic, { name: up ? "trendingUp" : "trendingDown", size: 18, style: { color: up ? "var(--up-text)" : "var(--down-text)" } }),
        h("div", { style: { fontSize: 13 } },
          h("span", { style: { color: "var(--ink-2)" } }, "Proyeksi "),
          h("span", { className: "num", style: { fontWeight: 800, color: up ? "var(--up-text)" : "var(--down-text)" } }, (up ? "+" : "") + SM.fmt(c.upside, 1) + "%"),
          h("span", { style: { color: "var(--ink-2)" } }, " dari harga kini"))),
      h("div", { style: { display: "flex", gap: 8, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 } },
        h(Ic, { name: "info", size: 14, style: { flexShrink: 0, marginTop: 1 } }),
        "Agregasi proyeksi analis — indikatif, bukan rekomendasi atau saran investasi."));
  }
  function ratingLeg(l, n, col) { return h("span", { style: { display: "inline-flex", alignItems: "center", gap: 5 } }, h("span", { style: { width: 7, height: 7, borderRadius: 99, background: col } }), h("span", { style: { fontWeight: 700 } }, l), h("span", { className: "num", style: { color: "var(--ink-3)" } }, n)); }
  function marker(left, col, label) {
    return h("div", { style: { position: "absolute", left: "calc(" + left + "% - 7px)", top: -3, width: 14, height: 14, borderRadius: 99, background: "#fff", border: "3px solid " + col, boxShadow: "var(--sh-xs)" }, title: label });
  }
  function tgt(l, v, dir) {
    var col = dir === "up" ? "var(--up-text)" : (dir === "down" ? "var(--down-text)" : "var(--ink)");
    return h("div", { style: { textAlign: "center" } },
      h("div", { className: "num", style: { fontSize: 16, fontWeight: 800, color: col } }, SM.fmt(v)),
      h("div", { style: { fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, marginTop: 1 } }, l));
  }

  /* ===================== Laporan Keuangan tab ===================== */
  function KeuanganTab(props) {
    var R = props.R, fin = R.financials;
    var maxRev = Math.max.apply(null, fin.quarters.map(function (q) { return q.revenue; }));
    return h("div", { className: "screen grid", style: { gap: 18 } },
      h("div", { className: "ringkasan-grid" },
        /* quarterly chart */
        h("div", { className: "card card-pad" },
          h("div", { style: { display: "flex", alignItems: "center", marginBottom: 4 } },
            h("div", { className: "section-title" }, h(Ic, { name: "barChart", size: 16 }), "Pendapatan & Laba Bersih"),
            h("div", { style: { marginLeft: "auto", display: "flex", gap: 12 } }, leg("#4F66E8", "Pendapatan"), leg("#16C784", "Laba Bersih"))),
          h("div", { className: "sub", style: { marginBottom: 18, color: "var(--ink-3)", fontSize: 12.5 } }, fin.period + " · dalam miliar Rupiah"),
          h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 10, height: 200, borderBottom: "1px solid var(--line)", paddingBottom: 2 } },
            fin.quarters.map(function (q, i) {
              return h("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 } },
                h("div", { style: { display: "flex", alignItems: "flex-end", gap: 5, height: 165 } },
                  bar(q.revenue / maxRev * 165, "#4F66E8", SM.fmt(q.revenue)),
                  bar(q.profit / maxRev * 165, "#16C784", SM.fmt(q.profit))),
                h("div", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 } }, q.label));
            })),
          h("div", { style: { display: "flex", gap: 14, marginTop: 16 } },
            growthStat("Pertumbuhan Pendapatan (YoY)", fin.revYoY),
            growthStat("Pertumbuhan Laba (YoY)", fin.profitYoY),
            growthStat("Margin Laba Bersih", fin.margin, true))),
        /* key lines */
        h("div", { className: "card", style: { height: "fit-content" } },
          h("div", { className: "card-head" }, h(Ic, { name: "coins", size: 18 }), h("div", { className: "ttl" }, "Ikhtisar Keuangan")),
          h("table", { className: "tbl" },
            h("thead", null, h("tr", null, h("th", null, "Pos"), h("th", { className: "r" }, "Nilai"), h("th", { className: "r" }, "YoY"))),
            h("tbody", null, fin.lines.map(function (ln, i) {
              var up = ln.yoy >= 0;
              return h("tr", { key: i, style: { cursor: "default" } },
                h("td", { style: { fontWeight: 600, color: "var(--ink-2)" } }, ln.name),
                h("td", { className: "r num", style: { fontWeight: 700 } }, ln.value),
                h("td", { className: "r" }, h("span", { className: "num val-" + (up ? "up" : "down"), style: { fontWeight: 700, fontSize: 12.5 } }, SM.pct(ln.yoy, 1))));
            })))) ),
      h("div", { className: "card card-pad", style: { display: "flex", alignItems: "flex-start", gap: 10 } },
        h(Ic, { name: "info", size: 16, style: { color: "var(--accent)", flexShrink: 0, marginTop: 1 } }),
        h("div", { style: { fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 } },
          "Data laporan keuangan ditarik dari publikasi emiten via penyedia data fundamental (mis. IDX / Sectors / GOAPI). Angka di sini contoh — backend mengisi nilai aktual per kuartal.")));
  }
  function bar(hpx, color, title) {
    return h("div", { title: title, style: { width: 18, height: Math.max(2, hpx), background: "linear-gradient(180deg," + color + "," + window.shade(color, -20) + ")", borderRadius: "4px 4px 2px 2px" } });
  }
  function growthStat(label, val, plain) {
    var up = val >= 0;
    var col = plain ? "var(--ink)" : (up ? "var(--up-text)" : "var(--down-text)");
    return h("div", { style: { flex: 1, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--line)" } },
      h("div", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginBottom: 5 } }, label),
      h("div", { className: "num", style: { fontSize: 19, fontWeight: 800, color: col } }, (plain ? "" : (up ? "+" : "")) + SM.fmt(val, 1) + "%"));
  }

  /* ===================== Fundamental tab ===================== */
  function FundamentalTab(props) {
    var R = props.R;
    var rows = [
      ["Sektor", R.sector], ["Industri", R.industry], ["Kapitalisasi Pasar", "Rp " + R.mcap],
      ["PER", R.per], ["PBV", R.pbv], ["EPS", "Rp " + R.eps], ["Book Value/Share", "Rp " + R.bookValue],
      ["Dividend Yield", R.divYield], ["ROE", R.roe], ["Net Margin", R.netMargin], ["DER", R.der], ["Beta", R.beta]
    ];
    return h("div", { className: "card screen" },
      h("div", { className: "card-head" }, h(Ic, { name: "barChart", size: 18 }), h("div", { className: "ttl" }, "Rasio Fundamental")),
      h("table", { className: "tbl" }, h("tbody", null, rows.map(function (r, i) {
        return h("tr", { key: i, style: { cursor: "default" } },
          h("td", { style: { color: "var(--ink-2)", fontWeight: 600, width: "55%" } }, r[0]),
          h("td", { className: "r num", style: { fontWeight: 700 } }, r[1]));
      }))));
  }

  /* ===================== Teknikal tab ===================== */
  function TeknikalTab(props) {
    var R = props.R, s = props.s;
    var candles = useMemo(function () { return SM.genCandles(s.seed * 5 + 130, 130, R.price, 0.024); }, [R.code]);
    var closes = candles.map(function (c) { return c.c; });
    var boll = bollinger(closes, 20, 2);
    var rsi = SM.rsiSeries(closes, 14);
    var macd = SM.macdSeries(closes);
    var vClass = R.verdict === "BULLISH" ? "bull" : (R.verdict === "BEARISH" ? "bear" : "neutral");
    return h("div", { className: "grid screen", style: { gap: 18 } },
      h("div", { className: "card card-pad" },
        h("div", { style: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 } },
          h("div", null, h("div", { className: "eyebrow", style: { marginBottom: 6 } }, "Verdict Agregat"),
            h("div", { className: "verdict " + vClass }, h(Ic, { name: R.verdict === "BEARISH" ? "trendingDown" : "trendingUp", size: 17 }), R.verdict)),
          h("div", { style: { color: "var(--ink-2)", fontSize: 13, maxWidth: 360, lineHeight: 1.5 } },
            "Sinyal teknikal tercampur — tren panjang positif (Golden Cross) namun harga di bawah SMA50 jangka pendek.")),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 } },
          R.signals.map(function (sig, i) {
            var ic = sig.state === "pos" ? "trendingUp" : (sig.state === "neg" ? "trendingDown" : "minus");
            return h("div", { className: "signal", key: i },
              h("div", { className: "signal-ic " + sig.state }, h(Ic, { name: ic, size: 17 })),
              h("div", { style: { minWidth: 0 } }, h("div", { className: "lbl" }, sig.name), h("div", { className: "vl" }, sig.value)));
          }))),
      h("div", { className: "card" },
        h("div", { className: "card-head", style: { flexWrap: "wrap", rowGap: 8 } },
          h(Ic, { name: "candlestick", size: 18 }), h("div", { className: "ttl" }, "Chart Multi-Panel"),
          h("div", { className: "spacer" }),
          h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
            leg("#4F66E8", "SMA 20"), leg("#E8A93C", "SMA 50"), leg("rgba(79,102,232,0.45)", "Bollinger"))),
        h("div", { className: "card-pad", style: { paddingTop: 12 } },
          h(window.CandleChart, { candles: candles, height: 290, bands: boll, overlays: [
            { values: SM.sma(closes, 20), color: "#4F66E8", width: 1.5 }, { values: SM.sma(closes, 50), color: "#E8A93C", width: 1.5 }
          ] }),
          h("div", { style: { borderTop: "1px solid var(--line-2)", marginTop: 6, paddingTop: 4 } }, h(window.VolumePanel, { candles: candles, height: 62 })),
          h("div", { style: { borderTop: "1px solid var(--line-2)", paddingTop: 4 } }, h(window.RSIPanel, { rsi: rsi, height: 78 })),
          h("div", { style: { borderTop: "1px solid var(--line-2)", paddingTop: 4 } }, h(window.MACDPanel, { data: macd, height: 80 })))));
  }

  /* ===================== Berita tab ===================== */
  function BeritaTab(props) {
    var R = props.R, sent = R.sentiment;
    var items = SM.NEWS.items.filter(function (n) { return n.tag === R.code || n.tag === "Pasar" || n.tag === "Komoditas"; });
    return h("div", { className: "grid screen", style: { gap: 14 } },
      h("div", { className: "card card-pad", style: { display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" } },
        h("div", { className: "section-title" }, h(Ic, { name: "sparkles", size: 16 }), "Sentimen " + R.code),
        sentPill("Positif", sent.pos, "pos"), sentPill("Netral", sent.neu, "neu"), sentPill("Negatif", sent.neg, "neg")),
      items.map(function (n, i) { return window.NewsCard(n, i); }));
  }

  /* ---- helpers ---- */
  function ctrl(label, control) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("span", { className: "eyebrow" }, label), control);
  }
  function mcell(l, v, dir) {
    var col = dir === "up" ? "var(--up-text)" : (dir === "down" ? "var(--down-text)" : "var(--ink)");
    return h("div", { className: "metric-cell" }, h("div", { className: "m-lbl" }, l), h("div", { className: "num", style: { fontSize: 19, fontWeight: 800, color: col, marginTop: 3 } }, v));
  }
  function valRow(l, v, dir) {
    var col = dir === "up" ? "var(--up-text)" : "var(--ink)";
    return h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 2px", borderBottom: "1px solid var(--line-2)" } },
      h("span", { style: { color: "var(--ink-2)", fontSize: 13.5, fontWeight: 600 } }, l),
      h("span", { className: "num", style: { fontWeight: 700, fontSize: 14.5, color: col } }, v));
  }
  function leg(c, l) { return h("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, h("span", { style: { width: 14, height: 3, borderRadius: 2, background: c } }), h("span", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 } }, l)); }
  function sentPill(l, n, k) {
    return h("div", { className: "badge " + k }, h("span", { style: { width: 7, height: 7, borderRadius: 99, background: "currentColor" } }), l + " · " + n);
  }

  window.Riset = Riset;
})();
