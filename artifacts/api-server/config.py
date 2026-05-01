from dataclasses import dataclass
from typing import Literal

# ───── GEN sabitleri ─────────────────────────────────────────────────────────
MIN_GEN = 0
MAX_GEN = 120
DEFAULT_START_GEN = 55
TRAININGS_PER_GEN = 10
TRAINING_COOLDOWN_SECS = 3600          # 1 saat
SEASON_END_GEN_DECAY = 15
HOME_BONUS = 3

# ───── Mevkiler ───────────────────────────────────────────────────────────────
@dataclass
class Position:
    code: str
    label: str
    category: Literal["GK", "DEF", "MID", "FWD"]

POSITIONS: list[Position] = [
    Position("GK",  "Kaleci",              "GK"),
    Position("CB",  "Stoper",              "DEF"),
    Position("LB",  "Sol Bek",             "DEF"),
    Position("RB",  "Sağ Bek",             "DEF"),
    Position("LWB", "Sol Kanat Bek",       "DEF"),
    Position("RWB", "Sağ Kanat Bek",       "DEF"),
    Position("CDM", "Defansif Orta Saha",  "MID"),
    Position("CM",  "Orta Saha",           "MID"),
    Position("CAM", "Hücum Orta Saha",     "MID"),
    Position("LM",  "Sol Orta Saha",       "MID"),
    Position("RM",  "Sağ Orta Saha",       "MID"),
    Position("LW",  "Sol Açık Kanat",      "FWD"),
    Position("RW",  "Sağ Açık Kanat",      "FWD"),
    Position("ST",  "Forvet",              "FWD"),
    Position("CF",  "Santrafor",           "FWD"),
]

_POS_MAP = {p.code: p for p in POSITIONS}

def find_position(code: str) -> Position | None:
    return _POS_MAP.get(code.upper().strip())

def position_category(code: str) -> Literal["GK", "DEF", "MID", "FWD"]:
    p = find_position(code)
    return p.category if p else "MID"

POSITION_ICONS = {"GK": "🧤", "DEF": "🛡️", "MID": "⚙️", "FWD": "⚔️"}
POSITION_CHOICES = [(f"{p.label} ({p.code})", p.code) for p in POSITIONS]

# ───── Dizilişler ─────────────────────────────────────────────────────────────
@dataclass
class Formation:
    code: str
    label: str
    tactic_boost: int
    style: str
    gk: int
    defenders: int
    midfielders: int
    forwards: int

FORMATIONS: list[Formation] = [
    Formation("4-4-2",     "4-4-2 Klasik",          3, "Dengeli", 1, 4, 4, 2),
    Formation("4-4-2-D",   "4-4-2 Diamond",          4, "Modern",  1, 4, 4, 2),
    Formation("4-3-3",     "4-3-3 Hücum",            5, "Hücum",   1, 4, 3, 3),
    Formation("4-3-3-F",   "4-3-3 (False 9)",        4, "Modern",  1, 4, 3, 3),
    Formation("4-2-3-1",   "4-2-3-1 Modern",         5, "Modern",  1, 4, 5, 1),
    Formation("4-1-4-1",   "4-1-4-1 Dengeli",        3, "Dengeli", 1, 4, 5, 1),
    Formation("4-5-1",     "4-5-1 Defansif",         2, "Defans",  1, 4, 5, 1),
    Formation("3-5-2",     "3-5-2 Klasik",           4, "Hücum",   1, 3, 5, 2),
    Formation("3-4-3",     "3-4-3 Hücum",            6, "Hücum",   1, 3, 4, 3),
    Formation("3-4-1-2",   "3-4-1-2",                4, "Modern",  1, 3, 5, 2),
    Formation("5-3-2",     "5-3-2 Defansif",         2, "Defans",  1, 5, 3, 2),
    Formation("5-4-1",     "5-4-1 Çok Defansif",     1, "Defans",  1, 5, 4, 1),
    Formation("4-1-2-1-2", "4-1-2-1-2 Diamond",      4, "Modern",  1, 4, 4, 2),
]

DEFAULT_FORMATION = "4-4-2"
_FORM_MAP = {f.code: f for f in FORMATIONS}

def find_formation(code: str) -> Formation | None:
    return _FORM_MAP.get(code.strip()) if code else None

def get_formation_or_default(code: str | None) -> Formation:
    return _FORM_MAP.get(code or "", _FORM_MAP[DEFAULT_FORMATION])

FORMATION_CHOICES = [(f"{f.label} • +{f.tactic_boost}", f.code) for f in FORMATIONS]

_TACTIC_ANALYSIS = {
    "Hücum":   "Yüksek pres ve geniş hücum açıları. Kanat bekleri sürekli ileri çıkar, orta saha hücuma destek verir.",
    "Defans":  "Sıkı defansif blok ve kontra ataklara odaklı. Top kaybında hızlı geri çekiliş esas alınır.",
    "Dengeli": "Dengeli hücum/defans dağılımı. Topa sahip olarak ve hızlı geçişlerle gol aranır.",
    "Modern":  "Hibrit sistem. Yüksek top sahipliği, oyun kurucu derinden başlatır, ileride pres üçgenleri kurulur.",
}

def formation_analysis(f: Formation) -> str:
    return _TACTIC_ANALYSIS.get(f.style, "Standart taktik planı.")
