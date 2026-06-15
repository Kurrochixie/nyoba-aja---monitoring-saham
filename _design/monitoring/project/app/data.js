/* =========================================================================
   SAHAM MONITOR — Data + locale (Indonesia)
   Format ID: ribuan = titik, desimal = koma  -> 6.231,97  ·  +3,73%
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Locale formatters ---------- */
  function fmt(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    dec = dec == null ? 0 : dec;
    var neg = n < 0;
    var s = Math.abs(n).toFixed(dec);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var out = parts.join(",");
    return (neg ? "−" : "") + out;
  }
  // price with sensible decimals (sub-100 stays integer in IDX; index uses 2)
  function rupiah(n, dec) { return "Rp " + fmt(n, dec == null ? 0 : dec); }
  function pct(n, dec) {
    dec = dec == null ? 2 : dec;
    var sign = n > 0 ? "+" : (n < 0 ? "" : "");
    return sign + fmt(n, dec) + "%";
  }
  function signed(n, dec) {
    var sign = n > 0 ? "+" : (n < 0 ? "−" : "");
    return sign + fmt(Math.abs(n), dec || 0);
  }
  // compact volume already given as strings in IDX style; keep as-is helper:
  function dir(n) { return n > 0 ? "up" : (n < 0 ? "down" : "flat"); }

  /* ---------- Deterministic pseudo-random (seeded) ---------- */
  function seeded(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // Build a believable OHLC candlestick series of `n` sessions ending near `last`.
  function genCandles(seed, n, last, volatility) {
    var rnd = seeded(seed);
    var vol = volatility || 0.022;
    var arr = [];
    // walk backwards from last with mean reversion-ish drift
    var price = last * (0.8 + rnd() * 0.1);
    for (var i = 0; i < n; i++) {
      var drift = ((last - price) / last) * 0.05;
      var ch = (rnd() - 0.48 + drift) * vol;
      var open = price;
      var close = Math.max(1, price * (1 + ch));
      var hi = Math.max(open, close) * (1 + rnd() * vol * 0.6);
      var lo = Math.min(open, close) * (1 - rnd() * vol * 0.6);
      var v = Math.round((0.5 + rnd()) * 1000);
      arr.push({ o: open, h: hi, l: lo, c: close, v: v });
      price = close;
    }
    // nudge last close to target
    var k = last / arr[arr.length - 1].c;
    arr[arr.length - 1].c = last;
    arr[arr.length - 1].h = Math.max(arr[arr.length - 1].h * 1, last * 1.004);
    return arr;
  }
  function genLine(seed, n, last, volatility, up) {
    var c = genCandles(seed, n, last, volatility);
    return c.map(function (d) { return d.c; });
  }
  // Simple moving average
  function sma(values, period) {
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      var s = 0; for (var j = i - period + 1; j <= i; j++) s += values[j];
      out.push(s / period);
    }
    return out;
  }
  function rsiSeries(values, period) {
    period = period || 14;
    var out = []; var gains = 0, losses = 0;
    for (var i = 1; i < values.length; i++) {
      var ch = values[i] - values[i - 1];
      var g = Math.max(0, ch), l = Math.max(0, -ch);
      if (i <= period) { gains += g; losses += l; out.push(null);
        if (i === period) { var rs0 = (gains / period) / ((losses / period) || 1e-9); out[out.length - 1] = 100 - 100 / (1 + rs0); }
      } else {
        gains = (gains * (period - 1) + g) / period;
        losses = (losses * (period - 1) + l) / period;
        var rs = gains / (losses || 1e-9);
        out.push(100 - 100 / (1 + rs));
      }
    }
    out.unshift(null);
    return out;
  }
  function ema(values, period) {
    var k = 2 / (period + 1); var out = []; var prev;
    for (var i = 0; i < values.length; i++) {
      if (i === 0) { prev = values[0]; out.push(prev); continue; }
      prev = values[i] * k + prev * (1 - k); out.push(prev);
    }
    return out;
  }
  function macdSeries(values) {
    var e12 = ema(values, 12), e26 = ema(values, 26);
    var macd = values.map(function (_, i) { return e12[i] - e26[i]; });
    var signal = ema(macd, 9);
    var hist = macd.map(function (m, i) { return m - signal[i]; });
    return { macd: macd, signal: signal, hist: hist };
  }

  // Dates parallel to a candle/line series, ending "today" (15 Jun 2026),
  // stepping back by interval. Returns [{full, axis}] oldest-first.
  function genDates(count, interval) {
    var months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    var d = new Date(2026, 5, 15);
    var arr = [];
    var longRange = count > 120 || interval === "Bulanan";
    for (var i = 0; i < count; i++) {
      var x = new Date(d);
      arr.unshift({
        full: x.getDate() + " " + months[x.getMonth()] + " " + x.getFullYear(),
        axis: longRange ? (months[x.getMonth()] + " '" + String(x.getFullYear()).slice(2)) : (x.getDate() + " " + months[x.getMonth()])
      });
      if (interval === "Mingguan") d.setDate(d.getDate() - 7);
      else if (interval === "Bulanan") d.setMonth(d.getMonth() - 1);
      else { do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    }
    return arr;
  }

  /* ---------- Index ---------- */
  var IHSG = {
    code: "IHSG", name: "IDX Composite", price: 6231.97, chg: 224.12, chgPct: 3.73,
    high: 6240.10, low: 6005.40, open: 6010.22, vol: "12,4 M lot", value: "Rp 14,8 T",
    spark: genLine(11, 60, 6231.97, 0.012)
  };

  /* ---------- Watchlist / stocks ---------- */
  // color: brand color per ticker for the square logo badge
  var STOCKS = [
    { code: "ANTM", name: "Aneka Tambang", sector: "Basic Materials", price: 3100, chg: 260, chgPct: 8.77, vol: "155,9 Jt", color: "#E8902C", seed: 21, volat: 0.03 },
    { code: "ASII", name: "Astra International", sector: "Industrials", price: 4950, chg: 210, chgPct: 4.43, vol: "20,8 Jt", color: "#2C6FE0", seed: 22, volat: 0.018 },
    { code: "BBCA", name: "Bank Central Asia", sector: "Financials", price: 6250, chg: 325, chgPct: 5.49, vol: "135,0 Jt", color: "#1B4FA0", seed: 23, volat: 0.016 },
    { code: "BBRI", name: "Bank Rakyat Indonesia", sector: "Financials", price: 2970, chg: 110, chgPct: 3.86, vol: "243,7 Jt", color: "#0E63AE", seed: 24, volat: 0.017 },
    { code: "BMRI", name: "Bank Mandiri", sector: "Financials", price: 4430, chg: 220, chgPct: 5.48, vol: "83,4 Jt", color: "#173E7C", seed: 25, volat: 0.018 },
    { code: "TLKM", name: "Telkom Indonesia", sector: "Communications", price: 2930, chg: 70, chgPct: 2.45, vol: "18,1 Jt", color: "#C8102E", seed: 26, volat: 0.015 },
    { code: "BUMI", name: "Bumi Resources", sector: "Energy", price: 170, chg: 13, chgPct: 8.28, vol: "1,2 M", color: "#5B7A1E", seed: 27, volat: 0.035 },
    { code: "GOTO", name: "GoTo Gojek Tokopedia", sector: "Technology", price: 50, chg: 0, chgPct: 0.00, vol: "4,1 M", color: "#00AA13", seed: 28, volat: 0.04 },
    { code: "CDIA", name: "Chandra Daya Investasi", sector: "Energy", price: 730, chg: 40, chgPct: 5.80, vol: "99,7 Jt", color: "#7A4DD6", seed: 29, volat: 0.03 },
    { code: "DCII", name: "DCI Indonesia", sector: "Technology", price: 188900, chg: 90, chgPct: 0.05, vol: "0,3 Jt", color: "#0E9488", seed: 30, volat: 0.02 }
  ];
  STOCKS.forEach(function (s) {
    s.spark = genLine(s.seed, 30, s.price, s.volat * 0.7);
    s.prevClose = s.price - s.chg;
  });
  // Official domains (favicon fallback) + curated TradingView logo slugs (sharp SVG)
  var DOMAINS = {
    ANTM: "antam.com", ASII: "astra.co.id", BBCA: "bca.co.id", BBRI: "bri.co.id",
    BMRI: "bankmandiri.co.id", TLKM: "telkom.co.id", BUMI: "bumiresources.com",
    GOTO: "gotocompany.com", CDIA: "chandra-asri.com", DCII: "dcicorp.id"
  };
  var TVLOGO = {
    ANTM: "antam--big.svg", ASII: "astra-international--big.svg", BBCA: "bank-central-asia--big.svg",
    BBRI: "bank-rakyat-indonesia--big.svg", BMRI: "bank-mandiri--big.svg"
  };
  STOCKS.forEach(function (s) {
    s.domain = DOMAINS[s.code] || null;
    s.logo = TVLOGO[s.code] ? ("https://s3-symbol-logo.tradingview.com/" + TVLOGO[s.code]) : null;
  });
  function getStock(code) { return STOCKS.filter(function (s) { return s.code === code; })[0]; }

  /* ---------- Riset: ANTM full profile ---------- */
  var RESEARCH = {
    ANTM: {
      code: "ANTM", name: "Aneka Tambang Tbk", sector: "Basic Materials", industry: "Logam & Pertambangan",
      price: 3100, chg: 180, chgPct: 6.32, high: 3040, low: 2950, open: 2960, vol: "72,3 Jt",
      mcap: "72,81 T", per: "10,10x", pbv: "1,87x", divYield: "5,33%",
      eps: "307", bookValue: "1.658", roe: "18,5%", netMargin: "14,2%", der: "0,42x", beta: "1,18",
      w52low: 2450, w52high: 4970,
      rsi: 43, rsiState: "Netral",
      verdict: "NETRAL",
      signals: [
        { name: "RSI(14)", value: "43", state: "neu", note: "Zona netral" },
        { name: "Harga vs SMA50", value: "Di bawah", state: "neg", note: "Tren jangka pendek turun" },
        { name: "SMA50 vs SMA200", value: "Golden Cross", state: "pos", note: "SMA50 > SMA200" },
        { name: "MACD", value: "Bullish", state: "pos", note: "Histogram positif" }
      ]
    }
  };

  /* ---------- Portfolio ---------- */
  var PORTFOLIO = {
    marketValue: 11880000, marketValueChg: 174000, marketValueChgPct: 1.79,
    totalCost: 11479650, unrealized: -1599650, unrealizedPct: -13.93, realized: 0,
    metrics: { totalReturn: -13.93, maxDrawdown: -22.4, sharpe: 0.41 },
    positions: [
      { code: "BBCA", name: "Bank Central Asia", lot: 8, avg: 8310, last: 6250, value: 5000000, pl: -1648000, plPct: -24.8, weight: 48, color: "#1B4FA0" },
      { code: "TLKM", name: "Telkom Indonesia", lot: 10, avg: 3045, last: 2930, value: 2930000, pl: -115000, plPct: -3.8, weight: 29, color: "#C8102E" },
      { code: "ANTM", name: "Aneka Tambang", lot: 8, avg: 2233, last: 3100, value: 2480000, pl: 693600, plPct: 38.8, weight: 23, color: "#E8902C" }
    ],
    history: [
      { date: "12 Jun 2026", code: "ANTM", type: "BUY", lot: 8, price: 2233, fee: 7150 },
      { date: "28 Mei 2026", code: "TLKM", type: "BUY", lot: 10, price: 3045, fee: 9100 },
      { date: "15 Mei 2026", code: "BBCA", type: "BUY", lot: 8, price: 8310, fee: 19900 }
    ],
    nav: genLine(77, 90, 11880000, 0.014)
  };

  /* ---------- Alerts ---------- */
  var ALERTS = {
    active: [
      { code: "BBCA", metric: "Harga", cond: "≥", value: "7.000", channels: ["in-app", "telegram"], cooldown: 30, on: true },
      { code: "ANTM", metric: "Perubahan %", cond: "≤", value: "−3", channels: ["in-app"], cooldown: 15, on: true },
      { code: "BBRI", metric: "Harga", cond: "≤", value: "2.800", channels: ["in-app", "desktop"], cooldown: 20, on: false }
    ],
    history: [
      { text: "BBCA: Harga 7.025 ≥ 7.000", time: "15 Jun 2026 · 10:12", state: "pos" },
      { text: "ANTM: Perubahan −3,4% ≤ −3", time: "11 Jun 2026 · 14:38", state: "neg" },
      { text: "BBCA: Harga 7.010 ≥ 7.000", time: "09 Jun 2026 · 09:41", state: "pos" }
    ],
    channels: [
      { name: "In-app", desc: "Notifikasi di dalam aplikasi", on: true, ic: "bell" },
      { name: "Telegram", desc: "@saham_monitor_bot", on: true, ic: "send" },
      { name: "Desktop", desc: "Notifikasi sistem operasi", on: false, ic: "monitor" }
    ]
  };

  /* ---------- News ---------- */
  var NEWS = {
    summary: { total: 45, pos: 9, neg: 1, neu: 35 },
    items: [
      { title: "Arah Pasar Saham Global 15–19 Juni: Wall Street & Bursa Asia Kompak Menguat", source: "Google News", time: "14 Jun · 22:00", sentiment: "neu", tag: "Pasar" },
      { title: "BEI Hukum Emiten Telat Lapor Keuangan, Denda hingga Rp 150 Juta", source: "kontan.co.id", time: "14 Jun · 18:20", sentiment: "neu", tag: "Regulasi" },
      { title: "ANTM Lanjutkan Penguatan, Volume Transaksi Melonjak Tajam", source: "CNBC Indonesia", time: "14 Jun · 16:05", sentiment: "pos", tag: "ANTM" },
      { title: "BBCA Cetak Rekor Tertinggi Setelah Rilis Laba Kuartal", source: "Bisnis.com", time: "14 Jun · 14:30", sentiment: "pos", tag: "BBCA" },
      { title: "Sektor Perbankan Pimpin Reli IHSG, Investor Asing Net Buy", source: "Investor Daily", time: "14 Jun · 11:15", sentiment: "pos", tag: "Pasar" },
      { title: "Harga Nikel Global Tertekan, Saham Tambang Bervariasi", source: "Reuters", time: "13 Jun · 20:40", sentiment: "neg", tag: "Komoditas" },
      { title: "GOTO Umumkan Buyback Saham Tahap Lanjutan Senilai Rp 1 T", source: "Kontan", time: "13 Jun · 17:50", sentiment: "pos", tag: "GOTO" },
      { title: "Rupiah Stabil di Tengah Sentimen The Fed, IHSG Diprediksi Konsolidasi", source: "Detik Finance", time: "13 Jun · 09:25", sentiment: "neu", tag: "Makro" }
    ]
  };

  /* ---------- Sector breadth (for dashboard sorotan) ---------- */
  var SECTORS = [
    { name: "Financials", chg: 4.8 }, { name: "Basic Materials", chg: 6.1 },
    { name: "Energy", chg: 3.2 }, { name: "Technology", chg: -1.4 },
    { name: "Industrials", chg: 2.6 }, { name: "Consumer", chg: 0.9 },
    { name: "Communications", chg: 1.8 }, { name: "Healthcare", chg: -0.6 }
  ];

  var MARKET = { status: "open", clock: "10:18 WIB", feed: "delayed", feedDelay: 15, advancers: 312, decliners: 118, unchanged: 64 };

  /* ---------- Export ---------- */
  window.SM = {
    fmt: fmt, rupiah: rupiah, pct: pct, signed: signed, dir: dir,
    genCandles: genCandles, genLine: genLine, sma: sma, rsiSeries: rsiSeries, macdSeries: macdSeries, ema: ema, genDates: genDates,
    IHSG: IHSG, STOCKS: STOCKS, getStock: getStock, RESEARCH: RESEARCH,
    PORTFOLIO: PORTFOLIO, ALERTS: ALERTS, NEWS: NEWS, SECTORS: SECTORS, MARKET: MARKET
  };
})();
