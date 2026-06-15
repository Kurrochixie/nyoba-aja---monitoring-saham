"""Konfigurasi global aplikasi Saham Monitor."""
from __future__ import annotations

import os

# ── Path ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")
CACHE_DIR = os.path.join(DATA_DIR, "cache")

# ── Watchlist default ───────────────────────────────────────────────────────
DEFAULT_WATCHLIST = [
    "^JKSE", "BBCA.JK", "BBRI.JK", "BMRI.JK", "TLKM.JK", "ASII.JK", "GOTO.JK", "ANTM.JK",
]

# ── TTL cache (detik) ───────────────────────────────────────────────────────
TTL_QUOTE = 20            # pendek -> terasa "live" saat auto-refresh
TTL_HISTORY = 300
TTL_INTRADAY = 60
TTL_FUNDAMENTALS = 3600
TTL_NAME = 86400
TTL_NEWS = 600

# ── Bursa (IDX) ─────────────────────────────────────────────────────────────
MARKET_TZ = "Asia/Jakarta"
MARKET_OPEN = (9, 0)
MARKET_CLOSE = (16, 0)

CURRENCY = "IDR"
DEFAULT_FEE_BUY = 0.0015     # 0.15%
DEFAULT_FEE_SELL = 0.0025    # 0.25%
LOT_SIZE = 100               # 1 lot IDX = 100 lembar
RF_RATE = 0.065              # risk-free ~BI rate, untuk Sharpe (IDR)

# ── Periode chart ───────────────────────────────────────────────────────────
PERIODS = {"1B": "1mo", "3B": "3mo", "6B": "6mo", "1T": "1y", "3T": "3y", "5T": "5y"}
INTRADAY = {"1H": ("1d", "5m"), "5H": ("5d", "15m")}  # (period, interval) yfinance

# ── Berita: feed RSS (Google News per-query = paling andal utk filter simbol) ─
GOOGLE_NEWS = "https://news.google.com/rss/search?q={q}&hl=id&gl=ID&ceid=ID:id"
NEWS_FEEDS_GENERAL = {
    "Pasar (Google News)": GOOGLE_NEWS.format(q="IHSG+OR+BEI+OR+saham+bursa"),
    "Detik Finance": "https://finance.detik.com/rss",
    "CNBC Indonesia - Market": "https://www.cnbcindonesia.com/market/rss",
}

# ── Sentimen berita (leksikon Bahasa Indonesia ringan, tanpa model) ─────────
POS_WORDS = {
    # Indonesia
    "naik", "menguat", "melonjak", "melesat", "untung", "cuan", "laba", "tumbuh",
    "positif", "rekor", "optimis", "surplus", "ekspansi", "akuisisi", "dividen",
    "lonjak", "meroket", "rebound", "pulih", "kuat", "tinggi", "raih", "capai",
    "bullish", "hijau", "apresiasi", "kenaikan", "pertumbuhan", "melambung",
    "reli", "pimpin", "memimpin", "meledak", "melejit", "terbang", "moncer",
    "diserbu", "serbu", "serok", "borong", "diborong", "perkasa", "kinclong",
    "tembus", "gacor", "cemerlang", "solid", "gainer", "gain", "profit", "menanjak",
    "menghijau", "melaju", "sprint", "kerek", "dongkrak", "topang", "untungkan",
    # English
    "surge", "surges", "surged", "rally", "rallies", "rallied", "jump", "jumps",
    "jumped", "soar", "soars", "soared", "gains", "rise", "rises", "rose", "climb",
    "climbs", "higher", "rebounds", "record", "outperform", "strong", "beat",
    "beats", "boost", "boosts", "top", "rallying", "upgrade", "upgraded",
}
NEG_WORDS = {
    # Indonesia
    "turun", "melemah", "anjlok", "merosot", "rugi", "negatif", "koreksi", "defisit",
    "phk", "gagal", "tekanan", "jeblok", "ambles", "longsor", "krisis", "jatuh",
    "terkoreksi", "lesu", "bearish", "merah", "tertekan", "penurunan", "ambruk",
    "susut", "terpuruk", "melorot", "pelemahan", "kerugian", "bangkrut",
    "ambrol", "terjun", "tumbang", "terkapar", "loyo", "boncos", "buntung",
    "tergerus", "melempem", "tersungkur", "memerah", "terseret", "tekan", "tergelincir",
    # English
    "plunge", "plunges", "plunged", "drop", "drops", "dropped", "fall", "falls",
    "fell", "slump", "slumps", "slumped", "tumble", "tumbles", "tumbled", "decline",
    "declines", "sink", "sinks", "lower", "loss", "losses", "weak", "miss", "misses",
    "crash", "crashes", "selloff", "slide", "slides", "downgrade", "downgraded",
}

# ── Indikator teknikal (default) ────────────────────────────────────────────
SMA_PERIODS = (20, 50, 200)
RSI_PERIOD = 14

# ── Nama emiten populer ─────────────────────────────────────────────────────
KNOWN_NAMES = {
    "^JKSE": "IHSG — Jakarta Composite",
    "BBCA.JK": "Bank Central Asia", "BBRI.JK": "Bank Rakyat Indonesia",
    "BMRI.JK": "Bank Mandiri", "BBNI.JK": "Bank Negara Indonesia",
    "BRIS.JK": "Bank Syariah Indonesia", "BBTN.JK": "Bank Tabungan Negara",
    "ARTO.JK": "Bank Jago", "TLKM.JK": "Telkom Indonesia",
    "ASII.JK": "Astra International", "UNVR.JK": "Unilever Indonesia",
    "ICBP.JK": "Indofood CBP", "INDF.JK": "Indofood Sukses Makmur",
    "GGRM.JK": "Gudang Garam", "HMSP.JK": "HM Sampoerna",
    "KLBF.JK": "Kalbe Farma", "GOTO.JK": "GoTo Gojek Tokopedia",
    "BUKA.JK": "Bukalapak", "EMTK.JK": "Elang Mahkota Teknologi",
    "ANTM.JK": "Aneka Tambang", "INCO.JK": "Vale Indonesia",
    "MDKA.JK": "Merdeka Copper Gold", "ADRO.JK": "Adaro Energy",
    "PTBA.JK": "Bukit Asam", "ITMG.JK": "Indo Tambangraya Megah",
    "PGAS.JK": "Perusahaan Gas Negara", "SMGR.JK": "Semen Indonesia",
    "INTP.JK": "Indocement Tunggal Prakarsa", "JSMR.JK": "Jasa Marga",
    "EXCL.JK": "XL Axiata", "ISAT.JK": "Indosat Ooredoo Hutchison",
    "TOWR.JK": "Sarana Menara Nusantara", "TBIG.JK": "Tower Bersama Infrastructure",
    "CPIN.JK": "Charoen Pokphand Indonesia", "JPFA.JK": "Japfa Comfeed Indonesia",
    "ACES.JK": "Aspirasi Hidup Indonesia (ACE)", "MAPI.JK": "Mitra Adiperkasa",
    "ERAA.JK": "Erajaya Swasembada", "AMRT.JK": "Sumber Alfaria Trijaya (Alfamart)",
    "UNTR.JK": "United Tractors", "MEDC.JK": "Medco Energi Internasional",
    "AKRA.JK": "AKR Corporindo", "BYAN.JK": "Bayan Resources",
    "AMMN.JK": "Amman Mineral Internasional", "TPIA.JK": "Chandra Asri Pacific",
    "BRPT.JK": "Barito Pacific", "ESSA.JK": "ESSA Industries Indonesia",
    "CDIA.JK": "Chandra Daya Investasi", "DCII.JK": "DCI Indonesia",
}
