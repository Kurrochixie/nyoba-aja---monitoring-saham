/* =========================================================================
   SAHAM MONITOR — Shared UI components
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;

  /* ---- Brand mark (simple candlestick glyph) ---- */
  function BrandMark(props) {
    var s = props.size || 22;
    return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none" },
      h("rect", { x: 4, y: 8, width: 3.4, height: 11, rx: 1.2, fill: "#fff", opacity: 0.92 }),
      h("rect", { x: 3.3, y: 5, width: 4.8, height: 2, rx: 1, fill: "#fff", opacity: 0.6 }),
      h("rect", { x: 10.3, y: 4, width: 3.4, height: 9, rx: 1.2, fill: "#fff" }),
      h("rect", { x: 9.6, y: 14, width: 4.8, height: 2, rx: 1, fill: "#fff", opacity: 0.6 }),
      h("rect", { x: 16.6, y: 10, width: 3.4, height: 9, rx: 1.2, fill: "#fff", opacity: 0.92 }));
  }

  /* ---- Stock square badge (logo when enabled, else initials) ---- */
  function StockBadge(props) {
    var st = React.useState(0); var step = st[0], setStep = st[1];
    var code = props.code || "", color = props.color || "#64748B";
    var sz = props.size || 32;
    var stk = (SM.getStock && SM.getStock(code)) || {};
    var dom = props.domain || stk.domain;
    var sources;
    if (props.logo) sources = [props.logo];
    else {
      sources = [];
      if (stk.logo) sources.push(stk.logo);
      if (dom) { sources.push("https://icon.horse/icon/" + dom); sources.push("https://www.google.com/s2/favicons?domain=" + dom + "&sz=64"); }
    }
    var useLogo = window.__SM_LOGOS && sources.length && step < sources.length;
    if (useLogo) {
      return h("div", { className: "stock-badge", style: { width: sz, height: sz, background: "#fff", border: "1px solid var(--line)", overflow: "hidden", fontSize: 0 } },
        h("img", { src: sources[step], alt: code, referrerPolicy: "no-referrer", loading: "lazy",
          style: { width: "100%", height: "100%", objectFit: "contain", padding: Math.round(sz * 0.1), boxSizing: "border-box" },
          onError: function () { setStep(step + 1); } }));
    }
    return h("div", { className: "stock-badge", style: { width: sz, height: sz, fontSize: sz * 0.34, background: "linear-gradient(135deg, " + color + ", " + shade(color, -18) + ")" } }, code.slice(0, 2));
  }
  /* Inisial 1-2 huruf dari nama untuk avatar. */
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var s = parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "");
    return s.toUpperCase();
  }
  function shade(hex, amt) {
    var c = hex.replace("#", ""); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
    return "#" + [r, g, b].map(function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }

  /* ---- Delta pill ---- */
  function Delta(props) {
    var pct = props.pct, chg = props.chg, size = props.size, plain = props.plain;
    var d = pct > 0 ? "up" : (pct < 0 ? "down" : "flat");
    var icon = d === "up" ? "arrowUpRight" : (d === "down" ? "arrowDownRight" : "minus");
    var cls = "delta " + d + (size === "lg" ? " lg" : "") + (plain ? " plain" : "");
    return h("span", { className: cls },
      h(Ic, { name: icon, size: size === "lg" ? 15 : 13 }),
      h("span", { className: "num" }, (chg != null ? SM.signed(chg, props.dec || 0) + "  " : "") + SM.pct(pct, props.pctDec == null ? 2 : props.pctDec)));
  }

  /* ---- Sidebar ---- */
  var NAV = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "riset", label: "Riset Saham", icon: "microscope" },
    { id: "portofolio", label: "Portofolio", icon: "briefcase" },
    { id: "alert", label: "Alert", icon: "bell", badge: 2 },
    { id: "berita", label: "Berita", icon: "newspaper" }
  ];

  function Sidebar(props) {
    return h("aside", { className: "sidebar" },
      h("div", { className: "brand" },
        h("div", { className: "brand-mark" }, h(BrandMark, { size: 22 })),
        h("div", null,
          h("div", { className: "brand-name" }, "Saham Monitor"),
          h("div", { className: "brand-sub" }, "Bursa Efek Indonesia"))),
      h("div", { className: "nav-section-label" }, "Menu"),
      h("nav", { className: "nav" },
        NAV.map(function (n) {
          return h("div", { key: n.id, className: "nav-item" + (props.active === n.id ? " active" : ""), onClick: function () { props.onNav(n.id); } },
            h(Ic, { name: n.icon, size: 19 }),
            h("span", null, n.label),
            n.badge && h("span", { className: "nav-badge" }, n.badge));
        })),
      h("div", { className: "nav-section-label" }, "Lainnya"),
      h("nav", { className: "nav" },
        h("div", { className: "nav-item" + (props.active === "pengaturan" ? " active" : ""), onClick: function () { props.onNav("pengaturan"); } },
          h(Ic, { name: "settings", size: 19 }), h("span", null, "Pengaturan")),
        h("div", { className: "nav-item" + (props.active === "styleguide" ? " active" : ""), onClick: function () { props.onNav("styleguide"); } },
          h(Ic, { name: "layers", size: 19 }), h("span", null, "Style Guide"))),
      h("div", { className: "sidebar-foot" },
        h("div", { className: "upgrade-card" },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
            h("div", { style: { width: 26, height: 26, borderRadius: 8, background: "var(--brand-grad)", display: "grid", placeItems: "center", color: "#fff" } }, h(Ic, { name: "wifi", size: 14 })),
            h("span", { style: { fontWeight: 700, fontSize: 13 } }, "Data Delayed")),
          h("div", { style: { fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.45 } }, "Hubungkan API realtime di Pengaturan untuk harga live."),
          h("div", { style: { marginTop: 10 } }, h("button", { className: "btn btn-primary btn-sm btn-block", onClick: function () { props.onNav("pengaturan"); } }, "Aktifkan Realtime"))),
        (function () {
          var prof = SM.PROFILE || { name: "Investor", role: "Investor Ritel" };
          return h("div", { className: "user-chip", style: { cursor: "pointer" }, title: "Ubah profil di Pengaturan", onClick: function () { props.onNav("pengaturan"); } },
            h("div", { className: "avatar" }, initials(prof.name)),
            h("div", { style: { minWidth: 0, flex: 1 } },
              h("div", { style: { fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, prof.name || "Investor"),
              h("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, prof.role || "Investor Ritel")),
            h(Ic, { name: "chevronRight", size: 16, style: { color: "var(--ink-3)" } }));
        })()));
  }

  /* ---- Ticker tape ---- */
  function Ticker() {
    var items = SM.STOCKS.concat([SM.IHSG]);
    var loop = items.concat(items);
    return h("div", { className: "ticker" },
      h("div", { className: "ticker-track" },
        loop.map(function (s, i) {
          var d = s.chgPct > 0 ? "up" : (s.chgPct < 0 ? "down" : "flat");
          var sym = d === "up" ? "▲" : (d === "down" ? "▼" : "■");
          return h("div", { className: "ticker-item", key: i },
            h("span", { className: "tk-code" }, s.code),
            h("span", { className: "tk-price num" }, SM.fmt(s.price, s.code === "IHSG" ? 2 : 0)),
            h("span", { className: "tk-chg num " + d }, sym + " " + SM.pct(s.chgPct, 2)));
        })));
  }

  /* ---- Header / topbar ---- */
  function Header(props) {
    return h("header", { className: "topbar" },
      h("div", { style: { minWidth: 0 } },
        h("div", { className: "page-title" }, props.title),
        props.sub && h("div", { className: "page-sub" }, props.sub)),
      h("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 } },
        props.right));
  }

  function StatusBar(props) {
    var open = SM.MARKET.status === "open";
    var live = SM.MARKET.feed === "realtime";
    return h("div", { className: "statusbar" },
      h("div", { className: "status-chip " + (open ? "open" : "closed") },
        h("span", { className: "pulse-dot" + (open ? "" : " gray") }), open ? "Bursa BUKA" : "Bursa TUTUP"),
      h("div", { className: "status-chip" }, h(Ic, { name: "clock", size: 14 }), "Diperbarui ", h("span", { className: "num", style: { marginLeft: 2 } }, SM.MARKET.clock)),
      h("button", { className: "status-chip feed" + (live ? " live" : ""), onClick: props.onSettings,
        title: live ? "Data realtime aktif" : "Data masih tertunda " + SM.MARKET.feedDelay + " menit — klik untuk hubungkan API realtime di Pengaturan" },
        live ? h("span", { className: "pulse-dot" }) : h("span", { className: "led amber" }),
        live ? "Realtime" : ("Tertunda " + SM.MARKET.feedDelay + " mnt"),
        !live && h(Ic, { name: "chevronRight", size: 13, style: { opacity: 0.5, marginLeft: 1 } })));
  }

  /* ---- Emiten selector (logo/icon + code chips, horizontal — replaces dropdown) ---- */
  function EmitenSelector(props) {
    var list = props.stocks || SM.STOCKS;
    return h("div", { className: "emiten-bar" },
      props.label && h("span", { className: "emiten-bar-label" }, props.label),
      h("div", { className: "emiten-track" },
        list.map(function (s) {
          var active = s.code === props.selected;
          var d = s.chgPct > 0 ? "up" : (s.chgPct < 0 ? "down" : "flat");
          return h("button", { key: s.code, className: "emiten-chip" + (active ? " active" : ""), onClick: function () { props.onSelect(s.code); } },
            h(StockBadge, { code: s.code, color: s.color, domain: s.domain, logo: s.logo, size: 24 }),
            h("span", { className: "ec-code" }, s.code),
            props.showDelta !== false && h("span", { className: "ec-delta num val-" + d }, SM.pct(s.chgPct, 1)));
        })));
  }

  function SearchBox(props) {
    return h("div", { className: "search" },
      h(Ic, { name: "search", size: 17 }),
      h("input", { placeholder: props.placeholder || "Cari saham (kode / nama)…", value: props.value || "", onChange: function (e) { props.onChange && props.onChange(e.target.value); } }),
      h("span", { className: "kbd" }, "/"));
  }

  function IconBtn(props) {
    return h("button", { className: "icon-btn", onClick: props.onClick, title: props.title },
      h(Ic, { name: props.icon, size: 19 }), props.badge && h("span", { className: "dot-badge" }));
  }

  /* ---- KPI card ---- */
  function KPICard(props) {
    var s = props.stock, hero = props.hero;
    var d = s.chgPct > 0 ? "up" : (s.chgPct < 0 ? "down" : "flat");
    return h("div", { className: "kpi" + (hero ? " kpi-hero" : ""), onClick: props.onClick, style: { cursor: props.onClick ? "pointer" : "default" } },
      h("div", { className: "kpi-top" },
        h("div", { className: "kpi-id" },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            h("span", { className: "code" }, s.code),
            props.tag && h("span", { className: "badge neu", style: { height: 19, fontSize: 10.5, padding: "0 7px" } }, props.tag)),
          h("div", { className: "name" }, s.name)),
        s.color ? h(StockBadge, { code: s.code, color: s.color, size: 36 })
          : h("div", { className: "kpi-logo", style: { background: "var(--brand-grad)" } }, h(Ic, { name: "activity", size: 18 }))),
      h("div", { className: "kpi-price num" }, SM.fmt(s.price, s.code === "IHSG" ? 2 : 0)),
      h("div", { className: "kpi-foot" },
        h(Delta, { pct: s.chgPct, chg: s.chg, dec: s.code === "IHSG" ? 0 : 0 }),
        s.spark && h("div", { className: "kpi-spark" }, h(window.Sparkline, { data: s.spark, width: hero ? 150 : 92, height: hero ? 44 : 38, id: s.code }))));
  }

  /* ---- Toast system ---- */
  function ToastHost(props) {
    return h("div", { className: "toast-wrap" },
      (props.toasts || []).map(function (t) {
        var ic = t.kind === "neg" ? "alertTriangle" : (t.kind === "info" ? "info" : "check");
        var col = t.kind === "neg" ? "var(--down)" : (t.kind === "info" ? "var(--accent)" : "var(--up)");
        var bg = t.kind === "neg" ? "var(--down-soft)" : (t.kind === "info" ? "var(--accent-soft)" : "var(--up-soft)");
        return h("div", { className: "toast", key: t.id },
          h("div", { className: "toast-ic", style: { background: bg, color: col } }, h(Ic, { name: ic, size: 18 })),
          h("div", { style: { flex: 1 } }, h("div", { className: "t-ttl" }, t.title), t.sub && h("div", { className: "t-sub" }, t.sub)),
          h("button", { className: "icon-btn", style: { width: 28, height: 28, boxShadow: "none", border: "none", background: "transparent" }, onClick: function () { props.onClose(t.id); } }, h(Ic, { name: "x", size: 15 })));
      }));
  }

  /* ---- Modal: tambah saham ke watchlist (pencarian + saran emiten) ---- */
  function AddWatchModal(props) {
    var us = React.useState([]); var universe = us[0], setUniverse = us[1];
    var ls = React.useState(true); var loading = ls[0], setLoading = ls[1];
    var qs = React.useState(""); var query = qs[0], setQuery = qs[1];
    React.useEffect(function () {
      fetch("/api/universe").then(function (r) { return r.json(); })
        .then(function (d) { setUniverse(d.stocks || []); setLoading(false); })
        .catch(function () { setLoading(false); });
    }, []);
    React.useEffect(function () {
      function onKey(e) { if (e.key === "Escape") props.onClose(); }
      window.addEventListener("keydown", onKey);
      return function () { window.removeEventListener("keydown", onKey); };
    }, []);
    var owned = {}; SM.STOCKS.forEach(function (s) { owned[s.code] = true; });
    var ql = query.toUpperCase().trim();
    var matches = universe.filter(function (s) {
      if (owned[s.code]) return false;
      if (!ql) return true;
      return s.code.indexOf(ql) >= 0 || (s.name || "").toUpperCase().indexOf(ql) >= 0;
    }).slice(0, 40);
    var custom = ql && !universe.some(function (s) { return s.code === ql; });
    function add(code) { if (code) props.onAdd(code); props.onClose(); }
    function item(code, name, color, hint) {
      return h("button", { key: code, className: "sm-modal-item", onClick: function () { add(code); } },
        h(window.StockBadge, { code: code, color: color, size: 32 }),
        h("div", { style: { flex: 1, minWidth: 0, textAlign: "left" } },
          h("div", { className: "cell-code" }, code),
          h("div", { className: "cell-name", style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, name)),
        h(Ic, { name: "plus", size: 17, style: { color: "var(--brand)", flexShrink: 0 } }));
    }
    return h("div", { className: "sm-modal-overlay", onClick: props.onClose },
      h("div", { className: "sm-modal", onClick: function (e) { e.stopPropagation(); } },
        h("div", { className: "sm-modal-head" },
          h("div", { className: "ttl" }, "Tambah ke Watchlist"),
          h("button", { className: "icon-btn", style: { width: 32, height: 32, boxShadow: "none" }, onClick: props.onClose }, h(Ic, { name: "x", size: 16 }))),
        h("div", { className: "sm-modal-search" },
          h(Ic, { name: "search", size: 17 }),
          h("input", { autoFocus: true, placeholder: "Cari kode atau nama emiten…", value: query,
            onChange: function (e) { setQuery(e.target.value); },
            onKeyDown: function (e) { if (e.key === "Enter" && ql) add(ql); } })),
        h("div", { className: "sm-modal-list" },
          loading ? h("div", { className: "sm-modal-empty" }, "Memuat daftar emiten…") : null,
          !loading && custom ? item(ql, "Tambahkan kode ini", "#64748B") : null,
          !loading ? matches.map(function (s) { return item(s.code, s.name, "#3B6FB0"); }) : null,
          !loading && !custom && matches.length === 0 ? h("div", { className: "sm-modal-empty" }, "Tidak ada hasil.") : null)));
  }

  Object.assign(window, {
    AddWatchModal: AddWatchModal,
    BrandMark: BrandMark, StockBadge: StockBadge, Delta: Delta, Sidebar: Sidebar,
    Ticker: Ticker, Header: Header, StatusBar: StatusBar, SearchBox: SearchBox, EmitenSelector: EmitenSelector,
    IconBtn: IconBtn, KPICard: KPICard, ToastHost: ToastHost, shade: shade, initials: initials
  });
})();
