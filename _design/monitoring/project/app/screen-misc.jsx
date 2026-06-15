/* =========================================================================
   SAHAM MONITOR — Alert · Berita · Pengaturan
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;

  /* ===================== Shared NewsCard ===================== */
  function NewsCard(n, i) {
    var map = { pos: ["pos", "Positif"], neg: ["neg", "Negatif"], neu: ["neu", "Netral"] };
    var s = map[n.sentiment];
    return h("a", { key: i, className: "card", href: "#", onClick: function (e) { e.preventDefault(); },
      style: { display: "flex", gap: 16, padding: 16, textDecoration: "none", color: "inherit", alignItems: "center", transition: "box-shadow .15s, transform .15s" },
      onMouseEnter: function (e) { e.currentTarget.style.boxShadow = "var(--sh-lg)"; e.currentTarget.style.transform = "translateY(-1px)"; },
      onMouseLeave: function (e) { e.currentTarget.style.boxShadow = "var(--sh)"; e.currentTarget.style.transform = "none"; } },
      h("div", { style: { width: 92, height: 64, borderRadius: 11, flexShrink: 0, background: "repeating-linear-gradient(135deg, var(--surface-3), var(--surface-3) 8px, var(--surface-2) 8px, var(--surface-2) 16px)", border: "1px solid var(--line)", display: "grid", placeItems: "center" } },
        h(Ic, { name: "newspaper", size: 22, style: { color: "var(--ink-4)" } })),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
          h("span", { className: "badge " + s[0] + " dot" }, s[1]),
          h("span", { className: "badge neu", style: { height: 21, fontSize: 11 } }, n.tag)),
        h("div", { style: { fontWeight: 700, fontSize: 14.5, lineHeight: 1.35, textWrap: "pretty" } }, n.title),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 12, color: "var(--ink-3)" } },
          h("span", { style: { fontWeight: 600 } }, n.source), h("span", null, "·"), h("span", null, n.time))),
      h(Ic, { name: "externalLink", size: 17, style: { color: "var(--ink-3)", flexShrink: 0 } }));
  }

  /* ===================== ALERT ===================== */
  function Alert(props) {
    var as = React.useState(SM.ALERTS.active.map(function (a) { return Object.assign({}, a); }));
    var alerts = as[0], setAlerts = as[1];
    var fs = React.useState({ code: "BBCA", metric: "Harga", cond: "≥", value: "", cooldown: "30", channels: { "in-app": true, telegram: false, desktop: false } });
    var form = fs[0], setForm = fs[1];
    var chSt = React.useState(SM.ALERTS.channels.map(function (c) { return Object.assign({}, c); })); var chanStatus = chSt[0], setChanStatus = chSt[1];

    function upd(k, v) { var o = Object.assign({}, form); o[k] = v; setForm(o); }
    function toggleCh(c) { var ch = Object.assign({}, form.channels); ch[c] = !ch[c]; upd("channels", ch); }
    function add() {
      if (!form.value) { props.toast({ kind: "neg", title: "Nilai kosong", sub: "Isi nilai ambang alert." }); return; }
      var chans = Object.keys(form.channels).filter(function (c) { return form.channels[c]; });
      if (!chans.length) chans = ["in-app"];
      var a = { code: form.code, metric: form.metric, cond: form.cond, value: form.value, channels: chans, cooldown: parseInt(form.cooldown, 10) || 30, on: true };
      setAlerts([a].concat(alerts)); upd("value", "");
      props.toast({ kind: "pos", title: "Alert dibuat", sub: form.code + " " + form.metric + " " + form.cond + " " + form.value });
    }
    function toggle(i) { setAlerts(alerts.map(function (a, x) { return x === i ? Object.assign({}, a, { on: !a.on }) : a; })); }
    function del(i) { setAlerts(alerts.filter(function (_, x) { return x !== i; })); }

    return h("div", { className: "screen split-main" },
      h("div", { className: "grid", style: { gap: 18 } },
        h("div", { className: "card" },
          h("div", { className: "card-head" }, h(Ic, { name: "bell", size: 18 }), h("div", { className: "ttl" }, "Alert Aktif"), h("div", { className: "sub", style: { marginLeft: "auto" } }, alerts.filter(function (a) { return a.on; }).length + " aktif")),
          alerts.length === 0 ? h("div", { className: "empty" }, h("div", { className: "empty-ic" }, h(Ic, { name: "bell", size: 28 })), h("h3", null, "Tidak ada alert"), h("p", null, "Buat alert pertamamu lewat form di samping.")) :
          h("div", null, alerts.map(function (a, i) {
            var s = SM.getStock(a.code) || { color: "#64748B", name: a.code };
            return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 13, padding: "14px 20px", borderBottom: i < alerts.length - 1 ? "1px solid var(--line-2)" : "none", opacity: a.on ? 1 : 0.55 } },
              h(window.StockBadge, { code: a.code, color: s.color, size: 34 }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontWeight: 800, fontSize: 14 } }, a.code),
                  h("span", { style: { fontSize: 13.5, color: "var(--ink-2)" } }, a.metric + " "),
                  h("span", { className: "num", style: { fontWeight: 700, fontSize: 13.5 } }, a.cond + " " + a.value)),
                h("div", { style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } },
                  a.channels.map(function (c) { return h("span", { key: c, className: "badge neu", style: { height: 21, fontSize: 11 } }, h(Ic, { name: c === "telegram" ? "send" : (c === "desktop" ? "monitor" : "bell"), size: 11 }), c); }),
                  h("span", { className: "badge accent", style: { height: 21, fontSize: 11 } }, h(Ic, { name: "clock", size: 11 }), "cooldown " + a.cooldown + "m"))),
              h("button", { className: "toggle" + (a.on ? " on" : ""), onClick: function () { toggle(i); }, "aria-label": "Aktif/Nonaktif" }),
              h("button", { className: "icon-btn", style: { width: 34, height: 34, boxShadow: "none" }, onClick: function () { del(i); }, title: "Hapus" }, h(Ic, { name: "trash", size: 15 })));
          }))),
        h("div", { className: "card" },
          h("div", { className: "card-head" }, h(Ic, { name: "clock", size: 18 }), h("div", { className: "ttl" }, "Riwayat Pemicu")),
          h("div", null, SM.ALERTS.history.map(function (hh, i) {
            return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < SM.ALERTS.history.length - 1 ? "1px solid var(--line-2)" : "none" } },
              h("div", { style: { width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: hh.state === "pos" ? "var(--up-soft)" : "var(--down-soft)", color: hh.state === "pos" ? "var(--up-text)" : "var(--down-text)" } }, h(Ic, { name: hh.state === "pos" ? "trendingUp" : "trendingDown", size: 15 })),
              h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 600, fontSize: 13.5 } }, hh.text)),
              h("div", { className: "num", style: { fontSize: 12, color: "var(--ink-3)" } }, hh.time));
          })))),

      /* form + channel status */
      h("div", { className: "grid", style: { gap: 18 } },
        h("div", { className: "card" },
          h("div", { className: "card-head" }, h(Ic, { name: "plusCircle", size: 18, style: { color: "var(--brand)" } }), h("div", { className: "ttl" }, "Buat Alert")),
          h("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 13 } },
            fld("Instrumen", h("div", { className: "select" }, h("select", { value: form.code, onChange: function (e) { upd("code", e.target.value); } }, SM.STOCKS.map(function (x) { return h("option", { key: x.code, value: x.code }, x.code + " · " + x.name); })), h("span", { className: "chev" }, h(Ic, { name: "chevronDown", size: 15 })))),
            fld("Metrik", h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, ["Harga", "Perubahan %"].map(function (m) {
              return h("button", { key: m, className: "chip" + (form.metric === m ? " on" : ""), style: { justifyContent: "center", height: 40 }, onClick: function () { upd("metric", m); } }, m);
            }))),
            h("div", { className: "field-row" },
              fld("Kondisi", h("div", { className: "select" }, h("select", { value: form.cond, onChange: function (e) { upd("cond", e.target.value); } }, ["≥", "≤", ">", "<"].map(function (c) { return h("option", { key: c }, c); })), h("span", { className: "chev" }, h(Ic, { name: "chevronDown", size: 15 })))),
              fld("Nilai", h("input", { className: "input num", placeholder: "0", value: form.value, onChange: function (e) { upd("value", e.target.value.replace(/[^0-9.,−-]/g, "")); } }))),
            fld("Cooldown (menit)", h("input", { className: "input num", value: form.cooldown, onChange: function (e) { upd("cooldown", e.target.value.replace(/\D/g, "")); } })),
            fld("Kanal Notifikasi", h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, [["in-app", "In-app", "bell"], ["telegram", "Telegram", "send"], ["desktop", "Desktop", "monitor"]].map(function (c) {
              var on = form.channels[c[0]];
              return h("button", { key: c[0], className: "chip" + (on ? " on" : ""), style: { justifyContent: "flex-start", height: 40 }, onClick: function () { toggleCh(c[0]); } },
                h(Ic, { name: c[2], size: 15 }), c[1], on && h(Ic, { name: "check", size: 15, style: { marginLeft: "auto" } }));
            }))),
            h("button", { className: "btn btn-primary btn-block", onClick: add }, h(Ic, { name: "bell", size: 16 }), "Buat Alert"))),
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title", style: { marginBottom: 12 } }, h(Ic, { name: "wifi", size: 16 }), "Status Kanal"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, chanStatus.map(function (c, i) {
            return h("div", { key: c.name, style: { display: "flex", alignItems: "center", gap: 11 } },
              h("div", { style: { width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: c.on ? "var(--up-soft)" : "var(--surface-3)", color: c.on ? "var(--up-text)" : "var(--ink-3)", transition: ".15s" } }, h(Ic, { name: c.ic, size: 15 })),
              h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 13 } }, c.name), h("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, c.desc)),
              h("span", { style: { fontSize: 11.5, fontWeight: 700, color: c.on ? "var(--up-text)" : "var(--ink-3)", marginRight: 2 } }, c.on ? "Aktif" : "Off"),
              h("button", { className: "toggle" + (c.on ? " on" : ""), "aria-label": (c.on ? "Nonaktifkan " : "Aktifkan ") + c.name,
                onClick: function () { setChanStatus(chanStatus.map(function (x, j) { return j === i ? Object.assign({}, x, { on: !x.on }) : x; })); props.toast({ kind: c.on ? "info" : "pos", title: "Kanal " + c.name + (c.on ? " dinonaktifkan" : " diaktifkan") }); } }));
          }))))
    );
  }

  /* ===================== BERITA ===================== */
  function Berita(props) {
    var fs = React.useState("Semua"); var filter = fs[0], setFilter = fs[1];
    var qs = React.useState(""); var query = qs[0], setQuery = qs[1];
    var sum = SM.NEWS.summary;
    var tags = ["Semua", "Pasar", "ANTM", "BBCA", "GOTO", "Regulasi"];
    var q = query.trim().toLowerCase();
    var items = SM.NEWS.items.filter(function (n) {
      var byTag = filter === "Semua" || n.tag === filter;
      var byQ = !q || n.title.toLowerCase().indexOf(q) >= 0 || n.source.toLowerCase().indexOf(q) >= 0 || n.tag.toLowerCase().indexOf(q) >= 0;
      return byTag && byQ;
    });
    var bars = [["Positif", sum.pos, "var(--up)"], ["Netral", sum.neu, "var(--ink-4)"], ["Negatif", sum.neg, "var(--down)"]];
    return h("div", { className: "screen split-main", style: { "--aside": "300px" } },
      h("div", { className: "grid", style: { gap: 14 } },
        h("div", { className: "card", style: { padding: "12px 14px" } },
          h("div", { className: "search", style: { width: "100%" } },
            h(Ic, { name: "search", size: 17 }),
            h("input", { placeholder: "Cari berita — judul, sumber, atau kode saham…", value: query, onChange: function (e) { setQuery(e.target.value); } }),
            query && h("button", { className: "icon-btn", style: { width: 26, height: 26, boxShadow: "none", border: "none", background: "transparent" }, onClick: function () { setQuery(""); } }, h(Ic, { name: "x", size: 15 })))),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
          tags.map(function (t) {
            return h("button", { key: t, className: "chip" + (filter === t ? " on" : ""), onClick: function () { setFilter(t); } }, t === "Semua" ? h(Ic, { name: "filter", size: 14 }) : null, t);
          }),
          h("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", fontWeight: 600 } },
            h(Ic, { name: "clock", size: 13 }), "Urut: terbaru · ", h("span", { className: "num" }, items.length), " hasil")),
        items.length ? items.map(function (n, i) { return NewsCard(n, i); })
          : h("div", { className: "card" }, h("div", { className: "empty" },
              h("div", { className: "empty-ic" }, h(Ic, { name: "search", size: 28 })),
              h("h3", null, "Tidak ada berita cocok"),
              h("p", null, "Coba kata kunci lain atau ganti filter sumber.")))),
      h("div", { className: "card card-pad sticky-aside" },
        h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "sparkles", size: 16 }), "Rollup Sentimen"),
        h("div", { style: { textAlign: "center", marginBottom: 16 } },
          h("div", { className: "num", style: { fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" } }, sum.total),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 } }, "total berita hari ini")),
        h("div", { className: "progress", style: { height: 12, marginBottom: 16 } },
          h("span", { style: { width: (sum.pos / sum.total * 100) + "%", background: "var(--up)" } }),
          h("span", { style: { width: (sum.neu / sum.total * 100) + "%", background: "var(--ink-4)" } }),
          h("span", { style: { width: (sum.neg / sum.total * 100) + "%", background: "var(--down)" } })),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 11, marginBottom: 14 } }, bars.map(function (b) {
          return h("div", { key: b[0], className: "legend-item" }, h("span", { className: "legend-dot", style: { background: b[2] } }), h("span", { className: "legend-name" }, b[0]), h("span", { className: "legend-val num" }, b[1]));
        })),
        h("div", { className: "src-note" }, h(Ic, { name: "info", size: 12 }), "Sentimen via NLP dari portal berita (Google News, CNBC, Kontan, dll.)")));
  }

  /* ===================== PENGATURAN ===================== */
  function Pengaturan(props) {
    var ws = React.useState(SM.STOCKS.map(function (s) { return s.code; })); var wl = ws[0], setWl = ws[1];
    var ns = React.useState(""); var newCode = ns[0], setNewCode = ns[1];
    function addW() { var c = newCode.toUpperCase().trim(); if (c && wl.indexOf(c) < 0) { setWl(wl.concat(c)); setNewCode(""); props.toast({ kind: "pos", title: "Ditambahkan", sub: c + " masuk watchlist" }); } }
    function delW(c) { setWl(wl.filter(function (x) { return x !== c; })); }
    return h("div", { className: "screen two-eq", style: { alignItems: "start" } },
      h("div", { className: "grid", style: { gap: 18 } },
        h("div", { className: "card" },
          h("div", { className: "card-head" }, h(Ic, { name: "eye", size: 18 }), h("div", { className: "ttl" }, "Watchlist")),
          h("div", { className: "card-pad" },
            h("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
              h("input", { className: "input", placeholder: "Kode saham (mis. UNVR)", value: newCode, onChange: function (e) { setNewCode(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") addW(); } }),
              h("button", { className: "btn btn-primary", onClick: addW }, h(Ic, { name: "plus", size: 16 }), "Tambah")),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, wl.map(function (c) {
              var s = SM.getStock(c);
              return h("div", { key: c, style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 6px", border: "1px solid var(--line)", borderRadius: 99, background: "var(--surface)" } },
                h(window.StockBadge, { code: c, color: s ? s.color : "#64748B", size: 24 }),
                h("span", { style: { fontWeight: 700, fontSize: 13 } }, c),
                h("button", { className: "icon-btn", style: { width: 22, height: 22, boxShadow: "none", border: "none", background: "transparent" }, onClick: function () { delW(c); } }, h(Ic, { name: "x", size: 13 })));
            })))),
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "info", size: 16 }), "Informasi"),
          h("div", { className: "metric-row", style: { gridTemplateColumns: "1fr 1fr" } },
            infoCell("Status Data", "Delayed ~15–20 mnt"), infoCell("Mata Uang", "Rupiah (IDR)"),
            infoCell("Satuan Lot", "1 lot = 100 lembar"), infoCell("Fee Default", "0,15% / transaksi")))),
      h("div", { className: "card" },
        h("div", { className: "card-head" }, h(Ic, { name: "key", size: 18 }), h("div", null, h("div", { className: "ttl" }, "Koneksi Data & Notifikasi"), h("div", { className: "sub" }, "Field rahasia — disimpan terenkripsi"))),
        h("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 15 } },
          secretField("API Key Harga Realtime", "sk_live_••••••••••••4f2a", "plug"),
          secretField("API Key Fundamental", "fd_••••••••••••9c10", "barChart"),
          secretField("Telegram Bot Token", "78••••••:AAH••••••••", "send"),
          secretField("Telegram Chat ID", "−100••••••3271", "send"),
          h("div", { style: { display: "flex", gap: 10, marginTop: 4 } },
            h("button", { className: "btn btn-primary", onClick: function () { props.toast({ kind: "pos", title: "Tersimpan", sub: "Kredensial diperbarui" }); } }, h(Ic, { name: "check", size: 16 }), "Simpan"),
            h("button", { className: "btn btn-secondary", onClick: function () { props.toast({ kind: "info", title: "Uji koneksi", sub: "Menghubungkan ke penyedia data…" }); } }, h(Ic, { name: "wifi", size: 16 }), "Uji Koneksi")),
          h("div", { style: { display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", background: "var(--accent-soft)", borderRadius: 11, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 } },
            h(Ic, { name: "shield", size: 15, style: { color: "var(--accent)", flexShrink: 0, marginTop: 1 } }),
            "Kredensial tidak pernah dikirim ke pihak lain dan hanya dipakai aplikasi untuk menarik data atas namamu.")))
    );
  }

  function secretField(label, val, ic) {
    return h("div", { className: "field" }, h("label", null, label),
      h("div", { style: { position: "relative" } },
        h("input", { className: "input mono", defaultValue: val, type: "text", style: { paddingLeft: 40, paddingRight: 40 } }),
        h("span", { style: { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" } }, h(Ic, { name: ic, size: 16 })),
        h("span", { style: { position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" } }, h(Ic, { name: "eye", size: 16 }))));
  }
  function infoCell(l, v) { return h("div", { className: "metric-cell" }, h("div", { className: "m-lbl" }, l), h("div", { style: { fontWeight: 700, fontSize: 14, marginTop: 3 } }, v)); }
  function fld(label, control) { return h("div", { className: "field" }, h("label", null, label), control); }

  Object.assign(window, { NewsCard: NewsCard, Alert: Alert, Berita: Berita, Pengaturan: Pengaturan });
})();
