/* =========================================================================
   SAHAM MONITOR — App controller
   ========================================================================= */
(function () {
  "use strict";
  var h = React.createElement;
  var Ic = window.Ic, SM = window.SM;

  var TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "indigo",
    "density": "regular",
    "radius": "regular",
    "ticker": true,
    "logos": false
  }/*EDITMODE-END*/;

  var ROUTES = {
    dashboard: { title: "Dashboard Pasar", sub: "Ringkasan IHSG, watchlist, dan detail instrumen", search: true },
    riset: { title: "Riset Saham", sub: "Analisa mendalam per emiten — fundamental & teknikal", search: false },
    portofolio: { title: "Portofolio", sub: "Posisi, alokasi, dan kinerja investasimu", search: false },
    alert: { title: "Alert", sub: "Notifikasi otomatis saat kondisi pasar terpenuhi", search: false },
    berita: { title: "Berita", sub: "Arus berita pasar dengan analisa sentimen", search: false },
    pengaturan: { title: "Pengaturan", sub: "Watchlist, koneksi data, dan notifikasi", search: false },
    styleguide: { title: "Style Guide", sub: "Token desain & komponen Saham Monitor", search: false }
  };

  function App() {
    var tw = window.useTweaks(TWEAK_DEFAULTS); var t = tw[0], setTweak = tw[1];
    var rs = React.useState("dashboard"); var route = rs[0], setRoute = rs[1];
    var sc = React.useState("ANTM"); var selected = sc[0], setSelected = sc[1];
    var qs = React.useState(""); var search = qs[0], setSearch = qs[1];
    var ts = React.useState([]); var toasts = ts[0], setToasts = ts[1];
    var searchRef = React.useRef(null);
    window.__SM_LOGOS = !!t.logos;

    /* apply tweaks → CSS */
    React.useEffect(function () {
      var root = document.documentElement;
      root.setAttribute("data-accent", t.accent);
      root.style.setProperty("--density", t.density === "compact" ? "0.84" : "1");
      root.style.setProperty("--radius-scale", t.radius === "sharp" ? "0.6" : (t.radius === "round" ? "1.3" : "1"));
    }, [t.accent, t.density, t.radius]);

    function toast(o) {
      var id = Date.now() + Math.random();
      setToasts(function (cur) { return cur.concat([Object.assign({ id: id }, o)]); });
      setTimeout(function () { setToasts(function (cur) { return cur.filter(function (x) { return x.id !== id; }); }); }, 3600);
    }
    function closeToast(id) { setToasts(function (cur) { return cur.filter(function (x) { return x.id !== id; }); }); }

    React.useEffect(function () {
      function onKey(e) {
        if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT" && document.activeElement.tagName !== "TEXTAREA") {
          e.preventDefault(); searchRef.current && searchRef.current.querySelector("input").focus();
        }
      }
      window.addEventListener("keydown", onKey); return function () { window.removeEventListener("keydown", onKey); };
    }, []);

    function nav(r) { setRoute(r); window.scrollTo && window.scrollTo(0, 0); var sa = document.querySelector(".scroll-area"); if (sa) sa.scrollTop = 0; }
    function openRiset(code) { setSelected(code); nav("riset"); }

    var meta = ROUTES[route];

    var rightActions = [
      meta.search && h("div", { key: "s", ref: searchRef }, h(window.SearchBox, { value: search, onChange: setSearch })),
      h(window.IconBtn, { key: "r", icon: "refresh", title: "Perbarui data", onClick: function () { toast({ kind: "info", title: "Memperbarui data…", sub: "Menarik harga terbaru (delayed)" }); } }),
      h(window.IconBtn, { key: "b", icon: "bell", title: "Notifikasi", badge: true, onClick: function () { nav("alert"); } })
    ];

    var screen;
    if (route === "dashboard") screen = h(window.Dashboard, { selected: selected, search: search, onSelect: setSelected, onOpenRiset: openRiset });
    else if (route === "riset") screen = h(window.Riset, { selected: selected, onSelect: setSelected });
    else if (route === "portofolio") screen = h(window.Portofolio, { toast: toast });
    else if (route === "alert") screen = h(window.Alert, { toast: toast });
    else if (route === "berita") screen = h(window.Berita, { toast: toast });
    else if (route === "pengaturan") screen = h(window.Pengaturan, { toast: toast });
    else if (route === "styleguide") screen = h(window.StyleGuide, null);

    return h("div", { className: "app" },
      h(window.Sidebar, { active: route, onNav: nav }),
      h("div", { className: "main" },
        t.ticker && h(window.Ticker, null),
        h("div", { className: "scroll-area" },
          h(window.Header, { title: meta.title, sub: route === "dashboard" ? h(window.StatusBar, { onSettings: function () { nav("pengaturan"); } }) : meta.sub, right: rightActions }),
          h("div", { className: "content" }, screen))),
      h(window.ToastHost, { toasts: toasts, onClose: closeToast }),
      h(TweaksUI, { t: t, setTweak: setTweak })
    );
  }

  function TweaksUI(props) {
    var t = props.t, setTweak = props.setTweak;
    var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection,
      TweakRadio = window.TweakRadio, TweakToggle = window.TweakToggle, TweakColor = window.TweakColor;
    return h(TweaksPanel, { title: "Tweaks" },
      h(TweakSection, { label: "Arah Visual" }),
      h(TweakColor, { label: "Aksen sekunder", value: t.accent === "indigo" ? "#4F66E8" : (t.accent === "violet" ? "#7C5CF5" : "#2C9FE0"),
        options: ["#4F66E8", "#7C5CF5", "#2C9FE0"],
        onChange: function (v) { setTweak("accent", v === "#4F66E8" ? "indigo" : (v === "#7C5CF5" ? "violet" : "ocean")); } }),
      h(TweakRadio, { label: "Densitas", value: t.density, options: ["compact", "regular"], onChange: function (v) { setTweak("density", v); } }),
      h(TweakRadio, { label: "Sudut", value: t.radius, options: ["sharp", "regular", "round"], onChange: function (v) { setTweak("radius", v); } }),
      h(TweakSection, { label: "Komponen" }),
      h(TweakToggle, { label: "Ticker tape", value: t.ticker, onChange: function (v) { setTweak("ticker", v); } }),
      h(TweakToggle, { label: "Logo emiten (asli)", value: t.logos, onChange: function (v) { setTweak("logos", v); } })
    );
  }

  window.SahamApp = App;
})();
