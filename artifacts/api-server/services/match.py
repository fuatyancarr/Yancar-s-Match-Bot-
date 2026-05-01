"""Maç simülasyonu servisi."""
from __future__ import annotations
import random
import math
from config import HOME_BONUS, position_category, get_formation_or_default, formation_analysis
import db
import ai_client


def _pick_weighted(items: list, weights: list):
    total = sum(weights)
    r = random.random() * total
    for item, w in zip(items, weights):
        r -= w
        if r <= 0:
            return item
    return items[-1]


def _poisson(lam: float) -> int:
    L = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        k += 1
        p *= random.random()
        if p <= L:
            return k - 1


def _expected_goals(our_gpr: float, their_gpr: float) -> float:
    diff = our_gpr - their_gpr
    return max(0.2, 1.35 + diff * 0.06)


def _outfield(squad: list[dict]) -> list[dict]:
    return [p for p in squad if position_category(p["position"]) != "GK"]


def _pick_scorer(squad: list[dict]) -> dict | None:
    out = _outfield(squad)
    if not out:
        return None
    weights = []
    for p in out:
        cat = position_category(p["position"])
        gen = p["rating"]
        if cat == "FWD":
            weights.append(gen * 3)
        elif cat == "MID":
            weights.append(gen * 1.5)
        else:
            weights.append(gen * 0.5)
    return _pick_weighted(out, weights)


def _pick_assister(squad: list[dict], scorer: dict) -> dict | None:
    candidates = [p for p in _outfield(squad) if p["id"] != scorer["id"]]
    if not candidates:
        return None
    weights = []
    for p in candidates:
        cat = position_category(p["position"])
        gen = p["rating"]
        if cat == "MID":
            weights.append(gen * 2.5)
        elif cat == "FWD":
            weights.append(gen * 1.5)
        else:
            weights.append(float(gen))
    return _pick_weighted(candidates, weights)


def _pick_random(squad: list[dict]) -> dict | None:
    return random.choice(squad) if squad else None


def _simulate_events(
    home_team: dict, away_team: dict,
    home_squad: list[dict], away_squad: list[dict],
    home_gpr: int, away_gpr: int,
    home_tactic_label: str, away_tactic_label: str,
) -> dict:
    home_xg = _expected_goals(home_gpr, away_gpr)
    away_xg = _expected_goals(away_gpr, home_gpr)

    home_score = min(7, _poisson(home_xg))
    away_score = min(7, _poisson(away_xg))

    home_shots = max(home_score + 1, round(home_xg * 6 + random.random() * 4))
    away_shots = max(away_score + 1, round(away_xg * 6 + random.random() * 4))
    home_on = max(home_score, round(home_shots * (0.35 + random.random() * 0.2)))
    away_on = max(away_score, round(away_shots * (0.35 + random.random() * 0.2)))

    total_gpr = home_gpr + away_gpr
    possession = max(35, min(70, round((home_gpr / total_gpr) * 100 + (random.random() * 6 - 3))))

    events: list[dict] = []
    goal_scorers: list[dict] = []
    card_events: list[dict] = []
    used_minutes: set[int] = set()

    def unique_minute(lo=1, hi=90) -> int:
        for _ in range(50):
            m = random.randint(lo, hi)
            if m not in used_minutes:
                used_minutes.add(m)
                return m
        return random.randint(lo, hi)

    for _ in range(home_score):
        scorer = _pick_scorer(home_squad)
        if not scorer:
            break
        assister = _pick_assister(home_squad, scorer) if random.random() < 0.7 else None
        minute = unique_minute()
        if assister:
            desc = f"⚽ GOOOOL! {scorer['name']} ağları sarsıyor! {assister['name']}'ın asistiyle {home_team['short_name']} öne geçiyor!"
        else:
            desc = f"⚽ GOOOOL! {scorer['name']} solo bir çıkışla muhteşem bir gol atıyor!"
        events.append({"minute": minute, "type": "GOL", "team": "ev",
                       "playerName": scorer["name"], "description": desc})
        entry = {"team_id": home_team["id"], "player_id": scorer["id"]}
        if assister:
            entry["assist_player_id"] = assister["id"]
        goal_scorers.append(entry)

    for _ in range(away_score):
        scorer = _pick_scorer(away_squad)
        if not scorer:
            break
        assister = _pick_assister(away_squad, scorer) if random.random() < 0.7 else None
        minute = unique_minute()
        if assister:
            desc = f"⚽ GOOOOL! Deplasmanda {scorer['name']}, {assister['name']}'ın pasıyla {away_team['short_name']}'ı öne geçiriyor!"
        else:
            desc = f"⚽ GOOOOL! {scorer['name']} {away_team['short_name']} adına ağları havalandırıyor!"
        events.append({"minute": minute, "type": "GOL", "team": "deplasman",
                       "playerName": scorer["name"], "description": desc})
        entry = {"team_id": away_team["id"], "player_id": scorer["id"]}
        if assister:
            entry["assist_player_id"] = assister["id"]
        goal_scorers.append(entry)

    for _ in range(random.randint(1, 4)):
        is_home = random.random() < 0.5
        p = _pick_random(home_squad if is_home else away_squad)
        if not p:
            continue
        minute = unique_minute()
        events.append({"minute": minute, "type": "SARI_KART",
                       "team": "ev" if is_home else "deplasman",
                       "playerName": p["name"],
                       "description": f"🟨 Sarı kart! {p['name']} hakem tarafından uyarıldı."})
        card_events.append({"player_id": p["id"], "type": "yellow"})

    if random.random() < 0.12:
        is_home = random.random() < 0.5
        p = _pick_random(home_squad if is_home else away_squad)
        if p:
            minute = unique_minute(40, 88)
            events.append({"minute": minute, "type": "KIRMIZI_KART",
                           "team": "ev" if is_home else "deplasman",
                           "playerName": p["name"],
                           "description": f"🟥 KIRMIZI KART! {p['name']} oyundan atıldı! Takım 10 kişi kaldı."})
            card_events.append({"player_id": p["id"], "type": "red"})

    events.sort(key=lambda e: e["minute"])

    return {
        "home_score": home_score,
        "away_score": away_score,
        "home_shots": home_shots,
        "away_shots": away_shots,
        "home_on": home_on,
        "away_on": away_on,
        "possession": possession,
        "events": events,
        "goal_scorers": goal_scorers,
        "card_events": card_events,
    }


async def _generate_narrative(
    home_team: dict, away_team: dict,
    home_score: int, away_score: int,
    home_gpr: int, away_gpr: int,
    home_label: str, away_label: str,
) -> str:
    prompt = f"""Sen tecrübeli bir Türk spor spikerisin. Aşağıdaki maç sonucu için kısa, akıcı, heyecanlı bir Türkçe maç özeti yaz (3-4 cümle, en fazla 600 karakter).

MAÇ:
- Ev sahibi: {home_team['name']} ({home_team['short_name']}) — GPR: {home_gpr}, Diziliş: {home_label}
- Deplasman: {away_team['name']} ({away_team['short_name']}) — GPR: {away_gpr}, Diziliş: {away_label}
- Skor: {home_score} - {away_score}

Spiker üslubuyla, özlü ve atmosferik yaz. Skoru, üstün gelen tarafı ve maçın tonunu anlat. Sadece düz metin dön, emoji kullanma.

YANIT FORMATI: {{ "narrative": "<özet metin>" }}"""
    try:
        res = await ai_client.generate_json(prompt)
        return str(res.get("narrative", ""))[:800]
    except Exception:
        if home_score > away_score:
            return f"{home_team['name']}, taraftarı önünde {away_team['name']}'ı {home_score}-{away_score} mağlup etti."
        elif away_score > home_score:
            return f"Sürpriz deplasmanda! {away_team['name']}, {home_team['name']}'ı kendi sahasında {away_score}-{home_score} yenmeyi başardı."
        else:
            return f"{home_team['name']} ile {away_team['name']} {home_score}-{away_score} berabere kaldı."


async def simulate_match(home_team_id: int, away_team_id: int) -> dict:
    home_team = await db.fetchrow("SELECT * FROM teams WHERE id=$1", home_team_id)
    away_team = await db.fetchrow("SELECT * FROM teams WHERE id=$1", away_team_id)

    if not home_team:
        raise ValueError("Ev sahibi takım bulunamadı")
    if not away_team:
        raise ValueError("Deplasman takımı bulunamadı")

    home_team = dict(home_team)
    away_team = dict(away_team)

    home_lineup = await db.get_lineup_players(home_team)
    away_lineup = await db.get_lineup_players(away_team)

    if not home_lineup:
        raise ValueError(f"{home_team['name']} için 11 kişilik kadro ayarlanmamış. `/kadro-ekle` kullanın.")
    if not away_lineup:
        raise ValueError(f"{away_team['name']} için 11 kişilik kadro ayarlanmamış. `/kadro-ekle` kullanın.")

    home_f = get_formation_or_default(home_team["formation"])
    away_f = get_formation_or_default(away_team["formation"])

    home_gpr = home_team["base_rating"] + HOME_BONUS + home_f.tactic_boost
    away_gpr = away_team["base_rating"] + away_f.tactic_boost

    sim = _simulate_events(
        home_team, away_team,
        home_lineup, away_lineup,
        home_gpr, away_gpr,
        home_f.label, away_f.label,
    )

    narrative = await _generate_narrative(
        home_team, away_team,
        sim["home_score"], sim["away_score"],
        home_gpr, away_gpr,
        home_f.label, away_f.label,
    )

    match_row = await db.insert_match(
        home_team_id, away_team_id,
        sim["home_score"], sim["away_score"],
        home_gpr, away_gpr,
        home_f.tactic_boost, away_f.tactic_boost,
        sim["possession"],
        sim["home_shots"], sim["away_shots"],
        sim["home_on"], sim["away_on"],
        narrative, sim["events"],
    )

    hw = sim["home_score"] > sim["away_score"]
    aw = sim["away_score"] > sim["home_score"]
    draw = not hw and not aw

    await db.update_team_match_result(home_team_id, sim["home_score"], sim["away_score"], hw, draw, aw)
    await db.update_team_match_result(away_team_id, sim["away_score"], sim["home_score"], aw, draw, hw)

    all_players = {p["id"]: p for p in home_lineup + away_lineup}
    for pid in all_players:
        await db.add_player_appearance(pid)
    for gs in sim["goal_scorers"]:
        await db.add_player_goal(gs["player_id"])
        if "assist_player_id" in gs:
            await db.add_player_assist(gs["assist_player_id"])
    for ce in sim["card_events"]:
        if ce["type"] == "yellow":
            await db.add_player_yellow_card(ce["player_id"])
        else:
            await db.add_player_red_card(ce["player_id"])

    return {
        "match_id": match_row["id"],
        "home_score": sim["home_score"],
        "away_score": sim["away_score"],
        "home_gpr": home_gpr,
        "away_gpr": away_gpr,
        "home_tactic_score": home_f.tactic_boost,
        "away_tactic_score": away_f.tactic_boost,
        "home_formation": home_f,
        "away_formation": away_f,
        "possession": sim["possession"],
        "home_shots": sim["home_shots"],
        "away_shots": sim["away_shots"],
        "home_on": sim["home_on"],
        "away_on": sim["away_on"],
        "events": sim["events"],
        "narrative": narrative,
        "home_lineup": home_lineup,
        "away_lineup": away_lineup,
    }
