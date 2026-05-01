"""AI ile görsel kadro çıkarma ve fuzzy matching."""
from __future__ import annotations
import unicodedata
import ai_client
import db
from config import find_formation, get_formation_or_default


def _normalize(s: str) -> str:
    s = s.lower()
    replacements = {"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g",
                    "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o",
                    "ç": "c", "Ç": "c"}
    for k, v in replacements.items():
        s = s.replace(k, v)
    return "".join(c if c.isalnum() or c == " " else " " for c in s).strip()


def _fuzzy_score(a: str, b: str) -> int:
    an, bn = _normalize(a), _normalize(b)
    if not an or not bn:
        return 0
    if an == bn:
        return 100
    if an in bn or bn in an:
        return 80
    a_tokens = an.split()
    b_tokens = bn.split()
    matches = sum(
        1 for t in a_tokens
        if len(t) >= 3 and any(t == x or x.startswith(t) or t.startswith(x) for x in b_tokens)
    )
    if matches == 0:
        return 0
    return round(matches / max(len(a_tokens), len(b_tokens)) * 70)


def match_players_to_squad(
    extracted_names: list[str], squad: list[dict]
) -> dict:
    matched = []
    unmatched = []
    used_ids: set[int] = set()

    for name in extracted_names:
        best = None
        for p in squad:
            if p["id"] in used_ids:
                continue
            score = _fuzzy_score(name, p["name"])
            if score > 0 and (best is None or score > best["score"]):
                best = {"player": p, "score": score}
        if best and best["score"] >= 50:
            matched.append({"extracted_name": name, "player": best["player"], "score": best["score"]})
            used_ids.add(best["player"]["id"])
        else:
            unmatched.append(name)

    return {"matched": matched, "unmatched": unmatched}


async def extract_lineup_from_image(image_url: str, content_type: str) -> dict:
    result = await ai_client.analyze_image_lineup(image_url, content_type or "image/png")
    names = result.get("playerNames", [])
    names = [n for n in names if isinstance(n, str) and n.strip()]
    return {
        "formation": result.get("formation"),
        "player_names": names,
        "raw_analysis": result.get("rawAnalysis", ""),
    }


async def save_lineup(team_id: int, player_ids: list[int], formation_code: str):
    if len(player_ids) != 11:
        raise ValueError(f"Kadroda 11 oyuncu olmalı, {len(player_ids)} verildi")
    f = get_formation_or_default(formation_code)
    await db.save_team_lineup(team_id, player_ids, f.code)
