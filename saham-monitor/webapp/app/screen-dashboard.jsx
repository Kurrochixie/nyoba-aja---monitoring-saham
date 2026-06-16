/* =========================================================================
   SAHAM MONITOR — Dashboard screen
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;

  var PERIODS = [
    { id: "1B", n: 22, v: 0.018 }, { id: "3B", n: 64, v: 0.02 }, { id: "6B", n: 130, v: 0.024 },
    { id: "1T", n: 240, v: 0.026 }, { id: "3T", n: 360, v: 0.03 }, { id: "5T", n: 460, v: 0.032 }
  ];

  function Dashboard(props) {
    var selCode = props.selected || "BBCA";
    var sel = SM.getStock(selCode) || SM.STOCKS[0] || { code: selCode, name: selCode, sector: "", price: 0, chg: 0, chgPct: 0, prevClose: 0, vol: "—", color: "#64748B", spark: [], seed: 1, volat: 0.02 };
    var ps = React.useState("3B"); var period = ps[0], setPeriod = ps[1];
    var cm = React.useState("builtin"); var chartMode = cm[0], setChartMode = cm[1];
    var ss = React.useState({ key: "chgPct", dir: -1 }); var sort = ss[0], setSort = ss[1];
    var q = (props.search || "").toLowerCase();

    var movers = [SM.getStock("ANTM"), SM.getStock("BBCA"), SM.getStock("BBRI")].filter(Boolean);

    var rows = SM.STOCKS.filter(function (s) {
      return !q || s.code.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0;
    }).slice().sort(function (a, b) {
      var k = sort.key; var av = a[k], bv = b[k];
      if (typeof av === "string") return av.localeCompare(bv) * sort.dir;
      return (av - bv) * sort.dir;
    });

    /* Candle harian NYATA dari API (sesuai periode terpilih). */
    var cd = React.useState(null); var fetched = cd[0], setFetched = cd[1];
    React.useEffect(function () {
      var alive = true; setFetched({ loading: true });
      fetch("/api/candles?code=" + encodeURIComponent(sel.code) + "&range=" + period)
        .then(function (r) { return r.json(); })
        .then(function (d) { if (alive) setFetched(d && d.ok && d.candles && d.candles.length ? d : { empty: true }); })
        .catch(function () { if (alive) setFetched({ empty: true }); });
      return function () { alive = false; };
    }, [sel.code, period]);
    var candles = (fetched && fetched.candles) || [];
    var dates = (fetched && fetched.dates) || [];
    var closes = candles.map(function (c) { return c.c; });
    var sma20 = SM.sma(closes, 20), sma50 = SM.sma(closes, 50);
    var chLoading = !!(fetched && fetched.loading);
    var chEmpty = !chLoading && !candles.length;

    function th(label, key, align) {
      var active = sort.key === key;
      return h("th", { className: (align === "r" ? "r " : "") + "sortable", onClick: function () { setSort({ key: key, dir: active ? -sort.dir : (key === "code" ? 1 : -1) }); } },
        label, h("span", { className: "sort-ic" }, h(Ic, { name: active ? (sort.dir === 1 ? "chevronUp" : "chevronDown") : "chevronDown", size: 13, style: { opacity: active ? 1 : 0.4 } })));
    }

    var breadth = SM.MARKET; var bN = breadth.advancers + breadth.decliners + breadth.unchanged; var bTot = bN || 1;

    return h("div", { className: "screen" },
      /* KPI row */
      h("div", { className: "kpi-grid stagger", style: { marginBottom: 18 } },
        h(window.KPICard, { stock: SM.IHSG, hero: true, tag: "INDEKS" }),
        movers.map(function (s) { return h(window.KPICard, { key: s.code, stock: s, onClick: function () { props.onSelect(s.code); } }); })),

      /* main grid */
      h("div", { className: "dash-grid", style: { marginBottom: 18 } },
        /* Watchlist */
        h("div", { className: "card" },
          h("div", { className: "card-head" },
            h(Ic, { name: "eye", size: 18, style: { color: "var(--ink-2)" } }),
            h("div", null, h("div", { className: "ttl" }, "Watchlist"), h("div", { className: "sub" }, rows.length + " instrumen dipantau")),
            h("div", { className: "spacer" }),
            h("button", { className: "btn btn-ghost btn-sm", onClick: function () { window.__SM_ADD_WATCH && window.__SM_ADD_WATCH(); } }, h(Ic, { name: "plus", size: 15 }), "Tambah")),
          h("div", { style: { overflowX: "auto" } },
            h("table", { className: "tbl" },
              h("thead", null, h("tr", null,
                th("Instrumen", "code"),
                h("th", null, "Tren 30H"),
                th("Terakhir", "price", "r"),
                th("Δ", "chg", "r"),
                th("Δ%", "chgPct", "r"),
                th("Volume", "volume", "r"))),
              h("tbody", null, rows.map(function (s) {
                var d = s.chgPct > 0 ? "up" : (s.chgPct < 0 ? "down" : "flat");
                return h("tr", { key: s.code, className: s.code === selCode ? "selected" : "", title: "Buka riset " + s.code, onClick: function () { props.onOpenRiset(s.code); } },
                  h("td", null, h("div", { className: "row-stock" },
                    h(window.StockBadge, { code: s.code, color: s.color, size: 32 }),
                    h("div", null, h("div", { className: "cell-code" }, s.code), h("div", { className: "cell-name" }, s.name)))),
                  h("td", null, h(window.Sparkline, { data: s.spark, width: 84, height: 30, id: s.code, area: false })),
                  h("td", { className: "r num", style: { fontWeight: 700 } }, s.stale ? "—" : SM.fmt(s.price)),
                  h("td", { className: "r num val-" + d }, s.stale ? "—" : SM.signed(s.chg)),
                  h("td", { className: "r" }, h("div", { style: { display: "flex", justifyContent: "flex-end" } }, s.stale ? h("span", { style: { color: "var(--ink-3)" } }, "—") : h(window.Delta, { pct: s.chgPct }))),
                  h("td", { className: "r num", style: { color: "var(--ink-2)" } }, s.vol));
              }))))),

        /* Sorotan pasar */
        h("div", { className: "grid", style: { gap: 18 } },
          h("div", { className: "card card-pad" },
            h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "gauge", size: 17 }), "Breadth Pasar"),
            h("div", { className: "progress", style: { height: 12, marginBottom: 14 } },
              h("span", { style: { width: (breadth.advancers / bTot * 100) + "%", background: "var(--up)" } }),
              h("span", { style: { width: (breadth.unchanged / bTot * 100) + "%", background: "var(--ink-4)" } }),
              h("span", { style: { width: (breadth.decliners / bTot * 100) + "%", background: "var(--down)" } })),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } },
              breadthStat("Naik", breadth.advancers, "var(--up-text)"),
              breadthStat("Tetap", breadth.unchanged, "var(--ink-2)"),
              breadthStat("Turun", breadth.decliners, "var(--down-text)")),
            srcNote("Sumber: watchlist (" + bN + " instrumen) · " + (breadth.feed === "realtime" ? "realtime" : "delayed " + breadth.feedDelay + "m"))),
          h("div", { className: "card card-pad" },
            h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "barChart", size: 17 }), "Performa Sektor"),
            h("div", { className: "sector-grid" },
              SM.SECTORS.map(function (sec) {
                var pos = sec.chg >= 0; var inten = Math.min(1, Math.abs(sec.chg) / 6.1);
                var bg = pos ? "rgba(22,199,132," + (0.05 + inten * 0.16).toFixed(3) + ")" : "rgba(246,70,93," + (0.05 + inten * 0.16).toFixed(3) + ")";
                var bd = pos ? "rgba(22,199,132,0.22)" : "rgba(246,70,93,0.22)";
                return h("div", { key: sec.name, className: "sector-tile", style: { background: bg, borderColor: bd } },
                  h("div", { className: "st-name", style: { color: "var(--ink-2)" } }, sec.name),
                  h("div", { className: "st-val", style: { color: pos ? "var(--up-text)" : "var(--down-text)" } },
                    h(Ic, { name: pos ? "trendingUp" : "trendingDown", size: 14 }), SM.pct(sec.chg, 1)));
              })),
            srcNote("Sumber: indeks sektoral IDX (IDX-IC)"))),
      ),

      /* Detail instrumen */
      h("div", { className: "card" },
        h("div", { style: { padding: "13px 20px", borderBottom: "1px solid var(--line-2)" } },
          h(window.EmitenSelector, { label: "Detail", selected: sel.code, onSelect: props.onSelect })),
        h("div", { className: "card-head" },
          h(window.StockBadge, { code: sel.code, color: sel.color, size: 38 }),
          h("div", null,
            h("div", { style: { display: "flex", alignItems: "center", gap: 9 } },
              h("span", { className: "ttl" }, sel.code),
              h(window.Delta, { pct: sel.chgPct, chg: sel.chg })),
            h("div", { className: "sub" }, sel.name + " · " + sel.sector)),
          h("div", { className: "spacer" }),
          h("div", { className: "segmented" }, [["builtin", "Bawaan"], ["tv", "TradingView"]].map(function (m) {
            return h("button", { key: m[0], className: chartMode === m[0] ? "active" : "", onClick: function () { setChartMode(m[0]); } }, m[1]);
          })),
          chartMode === "builtin" ? h("div", { className: "segmented", style: { marginLeft: 8 } }, PERIODS.map(function (p) {
            return h("button", { key: p.id, className: period === p.id ? "active" : "", onClick: function () { setPeriod(p.id); } }, p.id);
          })) : null,
          h("button", { className: "btn btn-secondary btn-sm", style: { marginLeft: 10 }, onClick: function () { props.onOpenRiset(sel.code); } }, h(Ic, { name: "microscope", size: 15 }), "Riset")),
        h("div", { className: "card-pad", style: { paddingTop: 14 } },
          h("div", { style: { display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 } },
            h("div", { className: "num", style: { fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em" } }, SM.fmt(sel.price)),
            h("div", { style: { display: "flex", gap: 18, marginLeft: "auto", flexWrap: "wrap" } },
              miniMetric("Tertinggi", SM.fmt(sel.high != null ? sel.high : Math.round(sel.price * 1.012)), "up"),
              miniMetric("Terendah", SM.fmt(sel.low != null ? sel.low : Math.round(sel.price * 0.984)), "down"),
              miniMetric("Volume", sel.vol),
              miniMetric("Prev", SM.fmt(sel.prevClose)))),
          chartMode === "builtin"
            ? (chLoading
                ? h("div", { style: { height: 300, display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13 } }, "Memuat data harga…")
                : chEmpty
                  ? h("div", { style: { height: 300, display: "grid", placeItems: "center", textAlign: "center", padding: 24, border: "1px dashed var(--line)", borderRadius: 12, color: "var(--ink-3)", fontSize: 13 } }, "Data harga belum tersedia. Coba lagi sebentar.")
                  : h(React.Fragment, null,
                      h("div", { style: { display: "flex", gap: 14, marginBottom: 4, alignItems: "center" } },
                        legendSwatch("#4F66E8", "SMA 20"), legendSwatch("#E8A93C", "SMA 50")),
                      h(window.CandleChart, { candles: candles, dates: dates, height: 300, overlays: [
                        { values: sma20, color: "#4F66E8", width: 1.6 }, { values: sma50, color: "#E8A93C", width: 1.6 }
                      ] }),
                      h(window.VolumePanel, { candles: candles, height: 64 })))
            : h(window.TVChart, { code: sel.code, height: 440 })))
    );
  }

  function breadthStat(label, val, color) {
    return h("div", { style: { textAlign: "center", padding: "10px 8px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--line)" } },
      h("div", { className: "num", style: { fontSize: 22, fontWeight: 800, color: color } }, SM.fmt(val)),
      h("div", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginTop: 2 } }, label));
  }
  function miniMetric(label, val, dir) {
    var col = dir === "up" ? "var(--up-text)" : (dir === "down" ? "var(--down-text)" : "var(--ink)");
    return h("div", { className: "metric", style: { alignItems: "flex-end" } },
      h("div", { className: "m-lbl" }, label),
      h("div", { className: "num", style: { fontSize: 15, fontWeight: 700, color: col } }, val));
  }
  function legendSwatch(color, label) {
    return h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
      h("span", { style: { width: 14, height: 3, borderRadius: 2, background: color } }),
      h("span", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 } }, label));
  }
  function srcNote(t) {
    return h("div", { className: "src-note", style: { marginTop: 12 } }, h(Ic, { name: "info", size: 12 }), t);
  }

  window.Dashboard = Dashboard;
})();
