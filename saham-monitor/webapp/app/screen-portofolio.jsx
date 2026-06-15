/* =========================================================================
   SAHAM MONITOR — Portofolio
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;
  var P = SM.PORTFOLIO;

  var MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  /* Tanggal hari ini dalam ISO (YYYY-MM-DD), waktu lokal — bukan UTC. */
  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  /* ISO "2026-06-15" → "15 Jun 2026". Bila sudah human-format, biarkan apa adanya. */
  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return s;
    return parseInt(m[3], 10) + " " + MONTHS_ID[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  function Portofolio(props) {
    var txns = P.history;
    var fs = React.useState({ date: todayISO(), code: "BBCA", type: "BUY", lot: "", price: "", fee: "" });
    var form = fs[0], setForm = fs[1];
    var hasData = txns.length > 0;

    function upd(k, v) { setForm(Object.assign({}, form, k === null ? v : (function () { var o = {}; o[k] = v; return o; })())); }

    function submit() {
      var lot = parseInt(form.lot, 10), price = parseInt(String(form.price).replace(/\./g, ""), 10);
      if (!lot || !price) { props.toast({ kind: "neg", title: "Lengkapi data", sub: "Lot dan harga wajib diisi." }); return; }
      window.SM_API.addTxn({ date: form.date, code: form.code, type: form.type, lot: lot, price: price, fee: parseInt(form.fee || "0", 10) || 0 });
      setForm(Object.assign({}, form, { lot: "", price: "", fee: "" }));
      props.toast({ kind: form.type === "BUY" ? "pos" : "info", title: "Transaksi dicatat", sub: form.type + " " + lot + " lot " + form.code + " @ " + SM.fmt(price) });
    }
    function del(t) { if (t && t.id != null) window.SM_API.delTxn(t.id); }

    var donut = P.positions.map(function (p) { return { value: p.value, color: p.color, label: p.code }; });

    return h("div", { className: "screen" },
      h("div", { className: "split-main", style: { "--aside": "380px" } },
        /* LEFT */
        h("div", { className: "grid", style: { gap: 18 } },
          hasData ? KPIs() : null,
          hasData ? Positions(P.positions) : EmptyState(),
          hasData ? h("div", { className: "two-eq" }, Allocation(donut), NAV()) : null,
          hasData ? History(txns, del) : null),

        /* RIGHT — form */
        h("div", { className: "card sticky-aside" },
          h("div", { className: "card-head" }, h(Ic, { name: "plusCircle", size: 18, style: { color: "var(--brand)" } }), h("div", { className: "ttl" }, "Catat Transaksi")),
          h("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 13 } },
            field("Tanggal", h("input", {
              type: "date", className: "input date-input", value: form.date, max: todayISO(),
              onChange: function (e) { upd("date", e.target.value); }
            })),
            field("Kode Saham", h("div", { className: "select" },
              h("select", { value: form.code, onChange: function (e) { upd("code", e.target.value); } },
                SM.STOCKS.map(function (x) { return h("option", { key: x.code, value: x.code }, x.code + " · " + x.name); })),
              h("span", { className: "chev" }, h(Ic, { name: "chevronDown", size: 15 })))),
            field("Tipe", h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
              ["BUY", "SELL"].map(function (tp) {
                var on = form.type === tp;
                return h("button", { key: tp, className: "chip" + (on ? (tp === "BUY" ? " on" : " on accent") : ""), style: { justifyContent: "center", height: 42 }, onClick: function () { upd("type", tp); } },
                  h(Ic, { name: tp === "BUY" ? "arrowDownRight" : "arrowUpRight", size: 15 }), tp);
              }))),
            h("div", { className: "field-row" },
              field("Lot", h("input", { className: "input num", placeholder: "0", value: form.lot, onChange: function (e) { upd("lot", e.target.value.replace(/\D/g, "")); } })),
              field("Harga/lembar", h("input", { className: "input num", placeholder: "0", value: form.price, onChange: function (e) { upd("price", e.target.value.replace(/\D/g, "")); } }))),
            field("Fee (opsional)", h("input", { className: "input num", placeholder: "0", value: form.fee, onChange: function (e) { upd("fee", e.target.value.replace(/\D/g, "")); } })),
            form.lot && form.price ? h("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--surface-3)", borderRadius: 11, fontSize: 13 } },
              h("span", { style: { color: "var(--ink-2)", fontWeight: 600 } }, "Nilai transaksi"),
              h("span", { className: "num", style: { fontWeight: 800 } }, SM.rupiah(parseInt(form.lot, 10) * 100 * parseInt(form.price, 10)))) : null,
            h("button", { className: "btn btn-primary btn-block", onClick: submit }, h(Ic, { name: "check", size: 16 }), "Simpan Transaksi"))))
    );
  }

  function KPIs() {
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))", gap: 18 } },
      pkpi("Nilai Pasar", SM.rupiah(P.marketValue), { pct: P.marketValueChgPct, chg: P.marketValueChg, label: "hari ini" }, "wallet"),
      pkpi("Total Modal", SM.rupiah(P.totalCost), null, "coins"),
      pkpi("P/L Belum Terealisasi", SM.signed(P.unrealized) === SM.signed(P.unrealized) ? (P.unrealized < 0 ? "−" : "") + "Rp " + SM.fmt(Math.abs(P.unrealized)) : "", { pct: P.unrealizedPct }, "trendingDown"),
      pkpi("P/L Terealisasi", "Rp " + SM.fmt(P.realized), null, "check"));
  }
  function pkpi(label, val, delta, icon) {
    var col = delta && delta.pct != null ? (delta.pct > 0 ? "var(--up-text)" : (delta.pct < 0 ? "var(--down-text)" : "var(--ink)")) : "var(--ink)";
    return h("div", { className: "kpi" },
      h("div", { className: "kpi-top" },
        h("div", { className: "eyebrow" }, label),
        h("div", { style: { width: 32, height: 32, borderRadius: 9, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--ink-2)" } }, h(Ic, { name: icon, size: 16 }))),
      h("div", { className: "num", style: { fontSize: 25, fontWeight: 800, letterSpacing: "-0.03em", color: col } }, val),
      delta ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        h(window.Delta, { pct: delta.pct, chg: delta.chg, dec: 0 }),
        delta.label && h("span", { style: { fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" } }, delta.label)) : h("div", { style: { height: 22 } }));
  }

  function Positions(positions) {
    return h("div", { className: "card" },
      h("div", { className: "card-head" }, h(Ic, { name: "briefcase", size: 18 }), h("div", { className: "ttl" }, "Posisi"), h("div", { className: "sub", style: { marginLeft: "auto" } }, positions.length + " saham")),
      h("div", { style: { overflowX: "auto" } },
        h("table", { className: "tbl" },
          h("thead", null, h("tr", null,
            h("th", null, "Saham"), h("th", { className: "r" }, "Lot"), h("th", { className: "r" }, "Avg"),
            h("th", { className: "r" }, "Terakhir"), h("th", { className: "r" }, "Nilai"), h("th", { className: "r" }, "P/L"), h("th", { className: "r" }, "Bobot"))),
          h("tbody", null, positions.map(function (p) {
            var d = p.pl > 0 ? "up" : (p.pl < 0 ? "down" : "flat");
            return h("tr", { key: p.code, style: { cursor: "default" } },
              h("td", null, h("div", { className: "row-stock" }, h(window.StockBadge, { code: p.code, color: p.color, size: 30 }),
                h("div", null, h("div", { className: "cell-code" }, p.code), h("div", { className: "cell-name" }, p.name)))),
              h("td", { className: "r num" }, p.lot),
              h("td", { className: "r num", style: { color: "var(--ink-2)" } }, SM.fmt(p.avg)),
              h("td", { className: "r num", style: { fontWeight: 700 } }, SM.fmt(p.last)),
              h("td", { className: "r num" }, SM.fmt(p.value)),
              h("td", { className: "r" }, h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 } },
                h("span", { className: "num val-" + d, style: { fontWeight: 700, fontSize: 13 } }, SM.signed(p.pl)),
                h("span", { className: "num val-" + d, style: { fontSize: 11.5 } }, SM.pct(p.plPct, 1)))),
              h("td", { className: "r" }, h("div", { style: { display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" } },
                h("div", { style: { width: 34, height: 6, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" } },
                  h("span", { style: { display: "block", height: "100%", width: p.weight + "%", background: p.color, borderRadius: 99 } })),
                h("span", { className: "num", style: { fontWeight: 700, fontSize: 12.5, width: 34 } }, p.weight + "%"))));
          }))))); 
  }

  function Allocation(donut) {
    return h("div", { className: "card card-pad" },
      h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "pieChart", size: 16 }), "Alokasi"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 18 } },
        h(window.Donut, { data: donut, size: 132, stroke: 22, center: h("div", null,
          h("div", { style: { fontSize: 10.5, color: "var(--ink-3)", fontWeight: 700 } }, "TOTAL"),
          h("div", { className: "num", style: { fontSize: 15, fontWeight: 800 } }, "Rp 10,4Jt")) }),
        h("div", { className: "legend", style: { flex: 1 } }, donut.map(function (s) {
          var pos = SM.PORTFOLIO.positions.filter(function (p) { return p.code === s.label; })[0];
          return h("div", { className: "legend-item", key: s.label },
            h("span", { className: "legend-dot", style: { background: s.color } }),
            h("span", { className: "legend-name" }, s.label),
            h("span", { className: "legend-val num" }, pos.weight + "%"));
        }))));
  }

  function NAV() {
    return h("div", { className: "card card-pad" },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
        h("div", { className: "section-title" }, h(Ic, { name: "trendingUp", size: 16 }), "Pertumbuhan Nilai"),
        h("div", { className: "num", style: { fontSize: 12.5, fontWeight: 700, color: "var(--down-text)" } }, "90 hari")),
      h(window.AreaChart, { data: P.nav, height: 120, color: "#4F66E8", id: "nav" }),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 } },
        nm("Return", SM.pct(P.metrics.totalReturn, 1), "down"), nm("Max DD", SM.pct(P.metrics.maxDrawdown, 1), "down"), nm("Sharpe", String(P.metrics.sharpe).replace(".", ","))));
  }
  function nm(l, v, dir) {
    var col = dir === "down" ? "var(--down-text)" : (dir === "up" ? "var(--up-text)" : "var(--ink)");
    return h("div", { style: { textAlign: "center", padding: "9px 6px", background: "var(--surface-2)", borderRadius: 11, border: "1px solid var(--line)" } },
      h("div", { className: "num", style: { fontSize: 16, fontWeight: 800, color: col } }, v), h("div", { style: { fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, marginTop: 1 } }, l));
  }

  function History(txns, del) {
    return h("div", { className: "card" },
      h("div", { className: "card-head" }, h(Ic, { name: "clock", size: 18 }), h("div", { className: "ttl" }, "Riwayat Transaksi"), h("div", { className: "sub", style: { marginLeft: "auto" } }, txns.length + " transaksi")),
      h("div", null, txns.map(function (t, i) {
        var s = SM.getStock(t.code) || { color: "#64748B", name: t.code };
        return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 13, padding: "13px 20px", borderBottom: i < txns.length - 1 ? "1px solid var(--line-2)" : "none" } },
          h("span", { className: "badge " + (t.type === "BUY" ? "pos" : "neg"), style: { width: 50, justifyContent: "center" } }, t.type),
          h(window.StockBadge, { code: t.code, color: s.color, size: 30 }),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontWeight: 700, fontSize: 13.5 } }, t.code + " · " + (s.name || "")),
            h("div", { style: { fontSize: 12, color: "var(--ink-3)" } }, fmtDate(t.date))),
          h("div", { style: { textAlign: "right" } },
            h("div", { className: "num", style: { fontWeight: 700, fontSize: 13.5 } }, t.lot + " lot @ " + SM.fmt(t.price)),
            h("div", { className: "num", style: { fontSize: 11.5, color: "var(--ink-3)" } }, "Fee " + SM.rupiah(t.fee))),
          h("button", { className: "icon-btn", style: { width: 32, height: 32, boxShadow: "none" }, title: "Hapus", onClick: function () { del(t); } }, h(Ic, { name: "trash", size: 15 })));
      })));
  }

  function EmptyState() {
    return h("div", { className: "card" }, h("div", { className: "empty" },
      h("div", { className: "empty-ic" }, h(Ic, { name: "briefcase", size: 30 })),
      h("h3", null, "Belum ada transaksi"),
      h("p", null, "Catat pembelian saham pertamamu lewat form di sebelah kanan untuk mulai melacak posisi & P/L secara live.")));
  }

  function field(label, control) { return h("div", { className: "field" }, h("label", null, label), control); }

  window.Portofolio = Portofolio;
})();
