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
    /* Hanya izinkan http/https (cegah href javascript:/data: dari feed RSS tak tepercaya). */
    var safeLink = n.link && /^https?:\/\//i.test(n.link) ? n.link : null;
    var hasLink = !!safeLink;
    return h("a", { key: n.link || n.title || i, className: "card",
      href: hasLink ? safeLink : "#",
      target: hasLink ? "_blank" : undefined,
      rel: hasLink ? "noopener noreferrer" : undefined,
      title: hasLink ? "Buka di " + (n.source || "sumber") : undefined,
      onClick: hasLink ? undefined : function (e) { e.preventDefault(); },
      style: { display: "flex", gap: 16, padding: 16, textDecoration: "none", color: "inherit", alignItems: "center", transition: "box-shadow .15s, transform .15s", cursor: hasLink ? "pointer" : "default" },
      onMouseEnter: function (e) { e.currentTarget.style.boxShadow = "var(--sh-lg)"; e.currentTarget.style.transform = "translateY(-1px)"; },
      onMouseLeave: function (e) { e.currentTarget.style.boxShadow = "var(--sh)"; e.currentTarget.style.transform = "none"; } },
      h("div", { style: { width: 92, height: 64, borderRadius: 11, flexShrink: 0, background: "repeating-linear-gradient(135deg, var(--surface-3), var(--surface-3) 8px, var(--surface-2) 8px, var(--surface-2) 16px)", border: "1px solid var(--line)", display: "grid", placeItems: "center" } },
        h(Ic, { name: "newspaper", size: 22, style: { color: "var(--ink-4)" } })),
      h("div", { style: { flex: 1, minWidth: 0 } },
        /* Baris meta atas: sumber + tanggal/waktu (menonjol) di kiri, sentimen + tag di kanan */
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" } },
          h("span", { style: { fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)" } }, n.source || "Sumber"),
          n.time ? h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-3)", fontWeight: 600 } },
            h(Ic, { name: "clock", size: 12 }), n.time) : null,
          h("span", { style: { flex: 1, minWidth: 8 } }),
          h("span", { className: "badge " + s[0] + " dot" }, s[1]),
          n.tag ? h("span", { className: "badge neu", style: { height: 21, fontSize: 11 } }, n.tag) : null),
        h("div", { style: { fontWeight: 700, fontSize: 14.5, lineHeight: 1.35, textWrap: "pretty" } }, n.title)),
      h(Ic, { name: "externalLink", size: 17, style: { color: "var(--ink-3)", flexShrink: 0 } }));
  }

  /* ===================== ALERT ===================== */
  function Alert(props) {
    var alerts = SM.ALERTS.active;
    var fs = React.useState({ code: "BBCA", metric: "Harga", cond: "≥", value: "", cooldown: "30", channels: { "in-app": true, telegram: false, desktop: false } });
    var form = fs[0], setForm = fs[1];
    var chSt = React.useState(SM.ALERTS.channels.map(function (c) { return Object.assign({}, c); })); var chanStatus = chSt[0], setChanStatus = chSt[1];

    function upd(k, v) { var o = Object.assign({}, form); o[k] = v; setForm(o); }
    function toggleCh(c) { var ch = Object.assign({}, form.channels); ch[c] = !ch[c]; upd("channels", ch); }
    function add() {
      if (!form.value) { props.toast({ kind: "neg", title: "Nilai kosong", sub: "Isi nilai ambang alert." }); return; }
      var chans = Object.keys(form.channels).filter(function (c) { return form.channels[c]; });
      if (!chans.length) chans = ["in-app"];
      window.SM_API.addRule({ symbol: form.code, metric: form.metric, op: form.cond, value: form.value, cooldown: parseInt(form.cooldown, 10) || 30, channels: chans })
        .then(function () { upd("value", ""); props.toast({ kind: "pos", title: "Alert dibuat", sub: form.code + " " + form.metric + " " + form.cond + " " + form.value }); })
        .catch(function () { props.toast({ kind: "neg", title: "Gagal membuat alert", sub: "Periksa nilai ambang (harus angka)." }); });
    }
    function toggle(i) { var a = alerts[i]; if (a && a.id != null) window.SM_API.toggleRule(a.id, !a.on); }
    function del(i) { var a = alerts[i]; if (a && a.id != null) window.SM_API.delRule(a.id); }

    return h("div", { className: "screen split-main" },
      h("div", { className: "grid", style: { gap: 18 } },
        h("div", { className: "card" },
          h("div", { className: "card-head" }, h(Ic, { name: "bell", size: 18 }), h("div", { className: "ttl" }, "Alert Aktif"), h("div", { className: "sub", style: { marginLeft: "auto" } }, alerts.filter(function (a) { return a.on; }).length + " aktif")),
          alerts.length === 0 ? h("div", { className: "empty" }, h("div", { className: "empty-ic" }, h(Ic, { name: "bell", size: 28 })), h("h3", null, "Tidak ada alert"), h("p", null, "Buat alert pertamamu lewat form di samping.")) :
          h("div", null, alerts.map(function (a, i) {
            var s = SM.getStock(a.code) || { color: "#64748B", name: a.code };
            return h("div", { key: a.id != null ? a.id : i, style: { display: "flex", alignItems: "center", gap: 13, padding: "14px 20px", borderBottom: i < alerts.length - 1 ? "1px solid var(--line-2)" : "none", opacity: a.on ? 1 : 0.55 } },
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
            return h("div", { key: (hh.time || "") + "|" + (hh.text || i), style: { display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < SM.ALERTS.history.length - 1 ? "1px solid var(--line-2)" : "none" } },
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
    var qs = React.useState(""); var query = qs[0], setQuery = qs[1];
    var fds = React.useState(null); var feed = fds[0], setFeed = fds[1];
    var ls = React.useState(true); var loading = ls[0], setLoading = ls[1];
    var sf2 = React.useState("Semua"); var sentFilter = sf2[0], setSentFilter = sf2[1];
    var srf = React.useState("Semua"); var srcFilter = srf[0], setSrcFilter = srf[1];
    var av = React.useState("SEMUA"); var active = av[0], setActive = av[1];
    var ao = React.useState(false); var addOpen = ao[0], setAddOpen = ao[1];
    var nk = React.useState(""); var newKw = nk[0], setNewKw = nk[1];

    var keywords = (SM.NEWS && SM.NEWS.keywords) || [];
    var keywordsKey = keywords.join("|");
    var qq = query.trim();
    var searchMode = qq.length >= 2;
    var effActive = (active === "SEMUA" || keywords.indexOf(active) >= 0) ? active : "SEMUA";

    /* Sumber berita aktif: pencarian bebas (debounce), SEMUA (stream gabungan), atau 1 kata kunci. */
    React.useEffect(function () {
      var ctrl = true; setLoading(true);
      var url, debounce = 0;
      if (searchMode) { url = "/api/news?q=" + encodeURIComponent(qq); debounce = 450; }
      else if (effActive === "SEMUA") { url = "/api/news/stream"; }
      else { url = "/api/news?q=" + encodeURIComponent(effActive); }
      function go() {
        fetch(url).then(function (r) { return r.json(); })
          .then(function (d) { if (ctrl) { setFeed((d && d.items) || []); setLoading(false); } })
          .catch(function () { if (ctrl) { setFeed([]); setLoading(false); } });
      }
      if (debounce) { var t = setTimeout(go, debounce); return function () { ctrl = false; clearTimeout(t); }; }
      go();
      return function () { ctrl = false; };
    }, [searchMode, qq, effActive, keywordsKey]);

    /* Reset filter sumber saat ganti sumber berita. */
    React.useEffect(function () { setSrcFilter("Semua"); }, [qq, effActive, keywordsKey]);

    function addKw(kw) {
      kw = (kw || "").trim();
      if (!kw) return;
      if (keywords.indexOf(kw) >= 0) { props.toast({ kind: "info", title: "Sudah ada", sub: "“" + kw + "” sudah jadi kata kunci" }); setNewKw(""); return; }
      window.SM_API.addNewsKeyword(kw)
        .then(function () { props.toast({ kind: "pos", title: "Kata kunci ditambah", sub: kw }); setActive(kw); })
        .catch(function () { props.toast({ kind: "neg", title: "Gagal menambah", sub: kw }); });
      setNewKw("");
    }
    function removeKw(kw) {
      if (keywords.length <= 3) { props.toast({ kind: "neg", title: "Minimal 3 kata kunci", sub: "Tambah dulu sebelum menghapus." }); return; }
      window.SM_API.delNewsKeyword(kw);
      if (effActive === kw) setActive("SEMUA");
    }

    var baseItems = feed || [];
    var srcCount = {};
    baseItems.forEach(function (n) { var sn = n.source || "Lainnya"; srcCount[sn] = (srcCount[sn] || 0) + 1; });
    var sources = Object.keys(srcCount).sort(function (a, b) { return srcCount[b] - srcCount[a]; });
    var effSrc = (srcFilter !== "Semua" && srcCount[srcFilter]) ? srcFilter : "Semua";
    var items = baseItems.filter(function (n) {
      return (sentFilter === "Semua" || n.sentiment === sentFilter) && (effSrc === "Semua" || n.source === effSrc);
    });

    function cnt(k) { return items.filter(function (n) { return n.sentiment === k; }).length; }
    var roll = { total: items.length, pos: cnt("pos"), neu: cnt("neu"), neg: cnt("neg") };
    var bars = [["Positif", roll.pos, "var(--up)"], ["Netral", roll.neu, "var(--ink-4)"], ["Negatif", roll.neg, "var(--down)"]];
    var pctOf = function (v) { return (roll.total ? v / roll.total * 100 : 0) + "%"; };
    var rollLabel = searchMode ? "hasil pencarian" : (effActive === "SEMUA" ? "berita gabungan" : "berita “" + effActive + "”");

    var resultMeta = h("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", fontWeight: 600 } },
      h(Ic, { name: "clock", size: 13 }), "Urut: terbaru · ", h("span", { className: "num" }, items.length), " hasil");

    /* Chip kata kunci favorit: [SEMUA] [kata kunci ×] … [+ Kata kunci] */
    var chipsRow = h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
      h("button", { className: "chip" + (effActive === "SEMUA" ? " on" : ""), onClick: function () { setActive("SEMUA"); } },
        h(Ic, { name: "layers", size: 14 }), "SEMUA"),
      keywords.map(function (kw) {
        return h("span", { key: kw, className: "chip" + (effActive === kw ? " on" : ""), style: { cursor: "pointer", paddingRight: 7 }, onClick: function () { setActive(kw); } },
          kw,
          h("span", { title: "Hapus kata kunci", onClick: function (e) { e.stopPropagation(); removeKw(kw); }, style: { marginLeft: 7, display: "inline-flex", alignItems: "center", opacity: 0.5 } }, h(Ic, { name: "x", size: 12 })));
      }),
      h("button", { className: "chip", style: { borderStyle: "dashed" }, onClick: function () { setAddOpen(!addOpen); } }, h(Ic, { name: "plus", size: 13 }), "Kata kunci"),
      resultMeta);

    /* Panel tambah kata kunci (saran dari watchlist + bebas ketik). */
    var suggestions = SM.STOCKS.map(function (s) { return s.code; }).filter(function (c) { return keywords.indexOf(c) < 0; }).slice(0, 12);
    var addPanel = h("div", { className: "card", style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
        h("input", { className: "input", autoFocus: true, placeholder: "Tambah kata kunci — emiten (BBCA) atau topik (dividen, IPO, suku bunga)…", value: newKw,
          onChange: function (e) { setNewKw(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") addKw(newKw); } }),
        h("button", { className: "btn btn-primary btn-sm", onClick: function () { addKw(newKw); } }, h(Ic, { name: "plus", size: 14 }), "Tambah"),
        h("button", { className: "btn btn-ghost btn-sm", onClick: function () { setAddOpen(false); } }, "Tutup")),
      suggestions.length ? h("div", { style: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" } },
        h("span", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700 } }, "Saran watchlist:"),
        suggestions.map(function (c) {
          return h("button", { key: c, className: "chip", style: { height: 30, padding: "0 10px" }, onClick: function () { addKw(c); } }, h(Ic, { name: "plus", size: 12 }), c);
        })) : null,
      keywords.length < 3 ? h("div", { style: { fontSize: 12, color: "var(--down-text)", fontWeight: 600 } }, "Disarankan minimal 3 kata kunci agar tab SEMUA kaya konten.") : null);

    /* Baris filter: sentimen (chip dot warna) + sumber (dropdown). */
    var sentChips = [["Semua", "Semua", null], ["pos", "Positif", "var(--up)"], ["neu", "Netral", "var(--ink-4)"], ["neg", "Negatif", "var(--down)"]];
    var filterBar = h("div", { style: { display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" } },
      h("span", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" } }, "Sentimen"),
      sentChips.map(function (c) {
        var on = sentFilter === c[0];
        return h("button", { key: c[0], className: "chip" + (on ? " on" : ""), style: { height: 32, padding: "0 11px" }, onClick: function () { setSentFilter(c[0]); } },
          c[2] ? h("span", { style: { width: 7, height: 7, borderRadius: 99, background: c[2], display: "inline-block" } }) : null, c[1]);
      }),
      h("span", { style: { width: 1, height: 20, background: "var(--line)", margin: "0 3px" } }),
      h("span", { style: { fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" } }, "Sumber"),
      h("div", { className: "select", style: { minWidth: 170 } },
        h("select", { value: effSrc, onChange: function (e) { setSrcFilter(e.target.value); } },
          [h("option", { key: "_all", value: "Semua" }, "Semua sumber (" + baseItems.length + ")")].concat(
            sources.map(function (sn) { return h("option", { key: sn, value: sn }, sn + " (" + srcCount[sn] + ")"); }))),
        h("span", { className: "chev" }, h(Ic, { name: "chevronDown", size: 15 }))));

    return h("div", { className: "screen split-main", style: { "--aside": "300px" } },
      h("div", { className: "grid", style: { gap: 14 } },
        h("div", { className: "card", style: { padding: "12px 14px" } },
          h("div", { className: "search", style: { width: "100%" } },
            h(Ic, { name: "search", size: 17 }),
            h("input", { placeholder: "Cari dadakan — emiten atau topik apa pun…", value: query, onChange: function (e) { setQuery(e.target.value); } }),
            query && h("button", { className: "icon-btn", style: { width: 26, height: 26, boxShadow: "none", border: "none", background: "transparent" }, onClick: function () { setQuery(""); } }, h(Ic, { name: "x", size: 15 })))),
        searchMode
          ? h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
              h("span", { style: { fontSize: 13, color: "var(--ink-2)", fontWeight: 600 } },
                loading ? "Mencari berita " : "Hasil pencarian ",
                h("span", { style: { color: "var(--ink)", fontWeight: 800 } }, "“" + qq + "”"),
                " via Google News"),
              resultMeta)
          : chipsRow,
        (!searchMode && addOpen) ? addPanel : null,
        filterBar,
        loading
          ? h("div", { className: "card" }, h("div", { className: "empty" },
              h("div", { className: "empty-ic" }, h(Ic, { name: "search", size: 28 })),
              h("h3", null, "Memuat berita…"),
              h("p", null, searchMode ? ("Menarik berita “" + qq + "” dari Google News.") : (effActive === "SEMUA" ? "Menggabungkan berita dari semua kata kunci favorit + pasar." : "Menarik berita “" + effActive + "”."))))
          : (items.length ? items.map(function (n, i) { return NewsCard(n, i); })
            : h("div", { className: "card" }, h("div", { className: "empty" },
                h("div", { className: "empty-ic" }, h(Ic, { name: "search", size: 28 })),
                h("h3", null, "Tidak ada berita"),
                h("p", null, "Coba ubah filter sentimen/sumber, ganti kata kunci, atau tambah kata kunci baru."))))),
      h("div", { className: "card card-pad sticky-aside" },
        h("div", { className: "section-title", style: { marginBottom: 14 } }, h(Ic, { name: "sparkles", size: 16 }), "Rollup Sentimen"),
        h("div", { style: { textAlign: "center", marginBottom: 16 } },
          h("div", { className: "num", style: { fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" } }, roll.total),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 } }, rollLabel)),
        h("div", { className: "progress", style: { height: 12, marginBottom: 16 } },
          h("span", { style: { width: pctOf(roll.pos), background: "var(--up)" } }),
          h("span", { style: { width: pctOf(roll.neu), background: "var(--ink-4)" } }),
          h("span", { style: { width: pctOf(roll.neg), background: "var(--down)" } })),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 11, marginBottom: 14 } }, bars.map(function (b) {
          return h("div", { key: b[0], className: "legend-item" }, h("span", { className: "legend-dot", style: { background: b[2] } }), h("span", { className: "legend-name" }, b[0]), h("span", { className: "legend-val num" }, b[1]));
        })),
        h("div", { className: "src-note" }, h(Ic, { name: "info", size: 12 }), "Sentimen via NLP dari portal berita (Google News, CNBC, Kontan, dll.)")));
  }

  /* ===================== PENGATURAN ===================== */
  function Pengaturan(props) {
    var wl = SM.STOCKS.map(function (s) { return s.code; });
    var ns = React.useState(""); var newCode = ns[0], setNewCode = ns[1];
    function addW() { var c = newCode.toUpperCase().trim(); if (c && wl.indexOf(c) < 0) { window.SM_API.addWatch(c).then(function () { props.toast({ kind: "pos", title: "Ditambahkan", sub: c + " masuk watchlist" }); }).catch(function () { props.toast({ kind: "neg", title: "Gagal menambah", sub: c + " — periksa kode/koneksi" }); }); setNewCode(""); } }
    function delW(c) { window.SM_API.delWatch(c); }

    /* Kelola API key — disimpan NYATA ke server (kv lokal di app.db). */
    var ks = React.useState({ GOAPI_KEY: "", SECTORS_KEY: "", TG_TOKEN: "", TG_CHAT_ID: "" });
    var keys = ks[0], setKeys = ks[1];
    var sst = React.useState({}); var keyStatus = sst[0], setKeyStatus = sst[1];
    var sav = React.useState(false); var saving = sav[0], setSaving = sav[1];
    React.useEffect(function () {
      fetch("/api/settings/keys").then(function (r) { return r.json(); }).then(function (d) { setKeyStatus(d || {}); }).catch(function () {});
    }, []);
    function setKey(k, v) { setKeys(function (cur) { var o = Object.assign({}, cur); o[k] = v; return o; }); }
    function saveKeys() {
      var body = {};
      ["GOAPI_KEY", "SECTORS_KEY", "TG_TOKEN", "TG_CHAT_ID"].forEach(function (k) { if (keys[k] && keys[k].trim()) body[k] = keys[k].trim(); });
      if (!Object.keys(body).length) { props.toast({ kind: "info", title: "Tidak ada perubahan", sub: "Isi minimal satu field untuk menyimpan." }); return; }
      setSaving(true);
      fetch("/api/settings/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          setSaving(false); setKeyStatus(d.status || {});
          setKeys({ GOAPI_KEY: "", SECTORS_KEY: "", TG_TOKEN: "", TG_CHAT_ID: "" });
          props.toast({ kind: "pos", title: "Kredensial tersimpan", sub: "Feed: " + (d.feed === "realtime" ? "realtime aktif" : "delayed") });
          if (window.SM_reload) window.SM_reload();
        })
        .catch(function () { setSaving(false); props.toast({ kind: "neg", title: "Gagal menyimpan", sub: "Periksa koneksi, coba lagi." }); });
    }
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
        h("div", { className: "card-head" }, h(Ic, { name: "key", size: 18 }), h("div", null, h("div", { className: "ttl" }, "Koneksi Data & Notifikasi"), h("div", { className: "sub" }, "Disimpan lokal di perangkat ini (data/app.db)"))),
        h("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 15 } },
          secretField("API Key Harga Realtime (GOAPI)", "GOAPI_KEY", "plug", keys, setKey, keyStatus),
          secretField("API Key Fundamental (Sectors)", "SECTORS_KEY", "barChart", keys, setKey, keyStatus),
          secretField("Telegram Bot Token", "TG_TOKEN", "send", keys, setKey, keyStatus),
          secretField("Telegram Chat ID", "TG_CHAT_ID", "send", keys, setKey, keyStatus),
          h("div", { style: { display: "flex", gap: 10, marginTop: 4 } },
            h("button", { className: "btn btn-primary", disabled: saving, onClick: saveKeys }, h(Ic, { name: "check", size: 16 }), saving ? "Menyimpan…" : "Simpan"),
            h("button", { className: "btn btn-secondary", onClick: function () { props.toast({ kind: "info", title: "Mengecek koneksi…", sub: "Menyegarkan status feed" }); if (window.SM_reload) window.SM_reload(); } }, h(Ic, { name: "wifi", size: 16 }), "Uji Koneksi")),
          h("div", { style: { display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", background: "var(--accent-soft)", borderRadius: 11, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 } },
            h(Ic, { name: "shield", size: 15, style: { color: "var(--accent)", flexShrink: 0, marginTop: 1 } }),
            "Key disimpan lokal (plaintext) di data/app.db pada perangkatmu, hanya dipakai aplikasi untuk menarik data. Field yang sudah terisi ditandai centang — isi ulang untuk mengganti.")))
    );
  }

  function secretField(label, name, ic, keys, setKey, status) {
    var isSet = !!(status && status[name]);
    return h("div", { className: "field" }, h("label", null, label),
      h("div", { style: { position: "relative" } },
        h("input", { className: "input mono", type: "password", autoComplete: "off", value: keys[name],
          placeholder: isSet ? "Tersimpan — isi untuk mengganti" : "Belum diisi",
          onChange: function (e) { setKey(name, e.target.value); }, style: { paddingLeft: 40, paddingRight: 40 } }),
        h("span", { style: { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" } }, h(Ic, { name: ic, size: 16 })),
        isSet ? h("span", { style: { position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "var(--up-text)" } }, h(Ic, { name: "check", size: 16 })) : null));
  }
  function infoCell(l, v) { return h("div", { className: "metric-cell" }, h("div", { className: "m-lbl" }, l), h("div", { style: { fontWeight: 700, fontSize: 14, marginTop: 3 } }, v)); }
  function fld(label, control) { return h("div", { className: "field" }, h("label", null, label), control); }

  Object.assign(window, { NewsCard: NewsCard, Alert: Alert, Berita: Berita, Pengaturan: Pengaturan });
})();
