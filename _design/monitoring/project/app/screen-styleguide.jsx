/* =========================================================================
   SAHAM MONITOR — Style Guide ringkas
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;

  function Swatch(hex, name, dark) {
    return h("div", { style: { borderRadius: 13, overflow: "hidden", border: "1px solid var(--line)", background: "var(--surface)" } },
      h("div", { style: { height: 64, background: hex } }),
      h("div", { style: { padding: "9px 11px" } },
        h("div", { style: { fontWeight: 700, fontSize: 12.5 } }, name),
        h("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: 1 } }, hex)));
  }

  function Block(title, ic, children) {
    return h("div", { className: "card card-pad" },
      h("div", { className: "section-title", style: { marginBottom: 16 } }, h(Ic, { name: ic, size: 17 }), title),
      children);
  }

  function StyleGuide() {
    return h("div", { className: "screen grid", style: { gap: 18 } },
      /* Colors */
      Block("Palet Warna", "layers", h("div", null,
        h("div", { className: "eyebrow", style: { marginBottom: 10 } }, "Semantik Pasar"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: 12, marginBottom: 18 } },
          Swatch("#16C784", "Naik / Brand"), Swatch("#0E9C66", "Naik (teks AA)"),
          Swatch("#F6465D", "Turun"), Swatch("#E11D48", "Turun (teks AA)"),
          Swatch("#94A3B8", "Netral / Flat"), Swatch("#4F66E8", "Aksen sekunder")),
        h("div", { className: "eyebrow", style: { marginBottom: 10 } }, "Netral & Permukaan"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: 12 } },
          Swatch("#0F172A", "Ink primary"), Swatch("#52617A", "Ink secondary"),
          Swatch("#94A3B8", "Ink muted"), Swatch("#E9EDF2", "Border"),
          Swatch("#F4F7FB", "Background"), Swatch("#FFFFFF", "Surface")))),

      /* Typography */
      Block("Tipografi — Plus Jakarta Sans", "sparkles", h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
        typeRow("Display / 40", 40, 800, "6.231,97"),
        typeRow("Heading / 22", 22, 800, "Dashboard Pasar"),
        typeRow("Title / 15", 15, 700, "Watchlist Saham Indonesia"),
        typeRow("Body / 14", 14, 500, "Pantau pergerakan IHSG dan portofolio harian."),
        typeRow("Mono / tabular", 14, 700, "155.900  ·  +8,77%  ·  Rp 11.880.000", true),
        h("div", { style: { fontSize: 12, color: "var(--ink-2)", background: "var(--surface-3)", borderRadius: 10, padding: "10px 12px" } },
          "Angka memakai font-variant-numeric: tabular-nums, rata kanan di tabel, locale ID (ribuan titik, desimal koma)."))),

      /* Spacing / radius / shadow */
      h("div", { className: "grid", style: { gridTemplateColumns: "1fr 1fr", gap: 18 } },
        Block("Radius", "circleDot", h("div", { style: { display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" } },
          [["9", 9], ["12", 12], ["16", 16], ["20", 20], ["26", 26]].map(function (r) {
            return h("div", { key: r[0], style: { textAlign: "center" } },
              h("div", { style: { width: 60, height: 60, background: "var(--brand-grad)", borderRadius: r[1], opacity: 0.9 } }),
              h("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: 6 } }, r[0] + "px"));
          }))),
        Block("Shadow", "layers", h("div", { style: { display: "flex", gap: 18, flexWrap: "wrap" } },
          [["sm", "var(--sh-sm)"], ["base", "var(--sh)"], ["lg", "var(--sh-lg)"]].map(function (s) {
            return h("div", { key: s[0], style: { textAlign: "center" } },
              h("div", { style: { width: 76, height: 56, background: "#fff", borderRadius: 14, boxShadow: s[1], border: "1px solid var(--line)" } }),
              h("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", marginTop: 10 } }, s[0]));
          })))),

      /* Components */
      Block("Komponen", "sliders", h("div", { style: { display: "flex", flexDirection: "column", gap: 20 } },
        compRow("Button", h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
          h("button", { className: "btn btn-primary" }, h(Ic, { name: "plus", size: 16 }), "Primary"),
          h("button", { className: "btn btn-secondary" }, "Secondary"),
          h("button", { className: "btn btn-ghost" }, "Ghost"),
          h("button", { className: "btn btn-primary btn-sm" }, "Small"))),
        compRow("Delta & Badge", h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } },
          h(window.Delta, { pct: 8.77, chg: 260 }), h(window.Delta, { pct: -3.8 }), h(window.Delta, { pct: 0 }),
          h("span", { className: "badge pos dot" }, "Positif"), h("span", { className: "badge neg dot" }, "Negatif"), h("span", { className: "badge neu" }, "Netral"))),
        compRow("Verdict", h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
          h("span", { className: "verdict bull" }, h(Ic, { name: "trendingUp", size: 16 }), "BULLISH"),
          h("span", { className: "verdict neutral" }, "NETRAL"),
          h("span", { className: "verdict bear" }, h(Ic, { name: "trendingDown", size: 16 }), "BEARISH"))),
        compRow("Input & Segmented", h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" } },
          h("input", { className: "input", placeholder: "Input field", style: { width: 200 } }),
          h("div", { className: "segmented" }, ["1B", "3B", "6B", "1T"].map(function (p, i) { return h("button", { key: p, className: i === 1 ? "active" : "" }, p); })))),
        compRow("Stock badge", h("div", { style: { display: "flex", gap: 10 } }, SM.STOCKS.slice(0, 6).map(function (s) { return h(window.StockBadge, { key: s.code, code: s.code, color: s.color, size: 38 }); })))
      ))
    );
  }

  function typeRow(label, size, weight, sample, mono) {
    return h("div", { style: { display: "flex", alignItems: "baseline", gap: 16, borderBottom: "1px solid var(--line-2)", paddingBottom: 12 } },
      h("div", { style: { width: 120, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, flexShrink: 0 } }, label),
      h("div", { className: mono ? "num" : "", style: { fontSize: size, fontWeight: weight, letterSpacing: size > 24 ? "-0.02em" : 0 } }, sample));
  }
  function compRow(label, control) {
    return h("div", { style: { display: "flex", alignItems: "center", gap: 18 } },
      h("div", { style: { width: 140, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 700, flexShrink: 0 } }, label), control);
  }

  window.StyleGuide = StyleGuide;
})();
