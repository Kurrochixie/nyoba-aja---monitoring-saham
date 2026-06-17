/* =========================================================================
   SAHAM MONITOR — Jembatan data live (merge window.SM + aksi POST ke API)
   ========================================================================= */
(function () {
  "use strict";

  function merge(d) {
    if (!d || !window.SM) return;
    var SM = window.SM;
    ["IHSG", "MARKET", "NEWS", "PORTFOLIO", "ALERTS", "RESEARCH", "PROFILE"].forEach(function (k) {
      if (d[k]) Object.assign(SM[k], d[k]);
    });
    ["STOCKS", "SECTORS"].forEach(function (k) {
      if (d[k]) { SM[k].length = 0; d[k].forEach(function (x) { SM[k].push(x); }); }
    });
    if (d._fired && d._fired.length && window.__SM_TOAST) {
      d._fired.forEach(function (detail) {
        window.__SM_TOAST({ kind: "pos", title: "Alert terpicu", sub: detail });
      });
    }
  }
  window.SM_merge = merge;

  window.SM_reload = function () {
    return fetch("/api/bootstrap")
      .then(function (r) { return r.json(); })
      .then(function (d) { merge(d); if (window.__SM_FORCE) window.__SM_FORCE(); })
      .catch(function () {});
  };

  /* Refresh RINGAN: hanya daftar watchlist (quote) — cepat, untuk update instan
     setelah tambah/hapus saham, tanpa menunggu bootstrap penuh (riset/berita). */
  window.SM_reload_stocks = function () {
    return fetch("/api/stocks")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.STOCKS && window.SM) {
          window.SM.STOCKS.length = 0;
          d.STOCKS.forEach(function (x) { window.SM.STOCKS.push(x); });
          if (window.__SM_FORCE) window.__SM_FORCE();
        }
      })
      .catch(function () {});
  };

  function req(url, method, body) {
    return fetch(url, {
      method: method || "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error("req " + r.status);
      return r.json().catch(function () { return {}; });
    });
  }

  // Setiap aksi: POST ke API → reload data live → re-render (route terjaga).
  window.SM_API = {
    addWatch: function (symbol) { return req("/api/watchlist", "POST", { symbol: symbol }).then(function () { if (window.SM_reload) window.SM_reload(); return window.SM_reload_stocks(); }); },
    delWatch: function (symbol) { return req("/api/watchlist/" + encodeURIComponent(symbol), "DELETE").then(function () { if (window.SM_reload) window.SM_reload(); return window.SM_reload_stocks(); }); },
    addTxn: function (t) { return req("/api/transactions", "POST", t).then(window.SM_reload); },
    delTxn: function (id) { return req("/api/transactions/" + id, "DELETE").then(window.SM_reload); },
    addRule: function (r) { return req("/api/rules", "POST", r).then(window.SM_reload); },
    delRule: function (id) { return req("/api/rules/" + id, "DELETE").then(window.SM_reload); },
    toggleRule: function (id, active) { return req("/api/rules/" + id + "/toggle", "POST", { active: active }).then(window.SM_reload); },
    addNewsKeyword: function (kw) { return req("/api/news-keywords", "POST", { keyword: kw }).then(window.SM_reload); },
    delNewsKeyword: function (kw) { return req("/api/news-keywords/" + encodeURIComponent(kw), "DELETE").then(window.SM_reload); },
    saveProfile: function (p) {
      return req("/api/profile", "POST", p).then(function (d) {
        if (d && d.profile && window.SM) { Object.assign(window.SM.PROFILE, d.profile); if (window.__SM_FORCE) window.__SM_FORCE(); }
        return d;
      });
    }
  };
})();
