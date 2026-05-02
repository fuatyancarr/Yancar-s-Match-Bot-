"""Database connection and all query functions (Safe Mode for Firebase)."""
from __future__ import annotations
import asyncpg
import os
import logging

log = logging.getLogger("turk-ligi")
_pool: asyncpg.Pool | None = None

async def get_pool() -> asyncpg.Pool | None:
    global _pool
    if _pool is None:
        # DATABASE_URL yoksa çökme, sadece uyarı ver
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            log.warning("⚠️ DATABASE_URL bulunamadı. SQL özellikleri devre dışı, Firebase üzerinden devam ediliyor.")
            return None
        try:
            _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
        except Exception as e:
            log.error(f"❌ SQL Veritabanı bağlantı hatası: {e}")
            return None
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

async def init_db():
    """Tabloları oluşturur (Eğer SQL bağlantısı varsa)."""
    pool = await get_pool()
    if pool is None:
        return  # Bağlantı yoksa burayı sessizce atla

    async with pool.acquire() as conn:
        await conn.execute("""
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    discord_role_id TEXT,
    guild_id TEXT,
    base_rating INTEGER NOT NULL DEFAULT 55,
    color TEXT DEFAULT '#e50914',
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    lineup_player_ids TEXT,
    lineup_set_at TIMESTAMPTZ,
    formation TEXT DEFAULT '4-4-2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    discord_user_id TEXT,
    guild_id TEXT,
    name TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT 'CM',
    rating INTEGER NOT NULL DEFAULT 55,
    goals INTEGER NOT NULL DEFAULT 0
);
        """)
        log.info("✅ SQL Tabloları kontrol edildi (Bağlantı aktif).")
    assists INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    appearances INTEGER NOT NULL DEFAULT 0,
    trainings_since_gen INTEGER NOT NULL DEFAULT 0,
    last_training_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    home_gpr INTEGER NOT NULL DEFAULT 0,
    away_gpr INTEGER NOT NULL DEFAULT 0,
    home_tactic_score INTEGER NOT NULL DEFAULT 0,
    away_tactic_score INTEGER NOT NULL DEFAULT 0,
    home_possession INTEGER NOT NULL DEFAULT 50,
    home_shots INTEGER NOT NULL DEFAULT 0,
    away_shots INTEGER NOT NULL DEFAULT 0,
    home_shots_on_target INTEGER NOT NULL DEFAULT 0,
    away_shots_on_target INTEGER NOT NULL DEFAULT 0,
    narrative TEXT,
    events TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainings (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    discord_user_id TEXT,
    guild_id TEXT,
    amount INTEGER NOT NULL DEFAULT 1,
    resulted_in_gen_increase INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gen_authorized_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
);
        """)


# ─── Helpers ──────────────────────────────────────────────────────────────────
async def fetchrow(query: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(query, *args)

async def fetch(query: str, *args):
    pool = await get_pool()
    return await pool.fetch(query, *args)

async def execute(query: str, *args):
    pool = await get_pool()
    return await pool.execute(query, *args)

async def fetchval(query: str, *args):
    pool = await get_pool()
    return await pool.fetchval(query, *args)


# ─── Teams ────────────────────────────────────────────────────────────────────
async def find_team_by_name(query: str):
    q = query.strip()
    if not q:
        return None
    row = await fetchrow(
        "SELECT * FROM teams WHERE name=$1 OR short_name=$1 LIMIT 1", q
    )
    if row:
        return dict(row)
    row = await fetchrow(
        "SELECT * FROM teams WHERE name ILIKE $1 OR short_name ILIKE $1 LIMIT 1",
        f"%{q}%",
    )
    return dict(row) if row else None


async def search_teams(query: str, limit: int = 25) -> list[dict]:
    q = query.strip()
    if not q:
        rows = await fetch(
            "SELECT * FROM teams ORDER BY base_rating DESC LIMIT $1", limit
        )
    else:
        rows = await fetch(
            "SELECT * FROM teams WHERE name ILIKE $1 OR short_name ILIKE $1 ORDER BY base_rating DESC LIMIT $2",
            f"%{q}%", limit,
        )
    return [dict(r) for r in rows]


async def list_teams() -> list[dict]:
    rows = await fetch("SELECT * FROM teams ORDER BY base_rating DESC")
    return [dict(r) for r in rows]


async def league_table() -> list[dict]:
    rows = await fetch(
        """SELECT * FROM teams
           ORDER BY points DESC,
                    (goals_for - goals_against) DESC,
                    goals_for DESC"""
    )
    return [dict(r) for r in rows]


async def update_team_base_rating(team_id: int, new_rating: int):
    await execute("UPDATE teams SET base_rating=$1 WHERE id=$2", new_rating, team_id)


async def update_team_formation(team_id: int, formation: str):
    await execute("UPDATE teams SET formation=$1 WHERE id=$2", formation, team_id)


async def save_team_lineup(team_id: int, player_ids: list[int], formation: str):
    await execute(
        "UPDATE teams SET lineup_player_ids=$1, lineup_set_at=NOW(), formation=$2 WHERE id=$3",
        json.dumps(player_ids), formation, team_id,
    )


async def clear_team_lineup(team_id: int):
    await execute(
        "UPDATE teams SET lineup_player_ids=NULL, lineup_set_at=NULL WHERE id=$1",
        team_id,
    )


async def insert_team(name: str, short_name: str, discord_role_id: str,
                      guild_id: str | None, base_rating: int, color: str) -> dict:
    row = await fetchrow(
        """INSERT INTO teams (name, short_name, discord_role_id, guild_id, base_rating, color)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *""",
        name, short_name, discord_role_id, guild_id, base_rating, color,
    )
    return dict(row)


async def reset_all_team_stats():
    await execute(
        """UPDATE teams SET wins=0, draws=0, losses=0, goals_for=0,
           goals_against=0, points=0, matches_played=0,
           lineup_player_ids=NULL, lineup_set_at=NULL"""
    )


async def update_team_match_result(team_id: int, gf: int, ga: int,
                                   win: bool, draw: bool, loss: bool):
    pts = 3 if win else (1 if draw else 0)
    await execute(
        """UPDATE teams SET
           matches_played=matches_played+1,
           goals_for=goals_for+$1,
           goals_against=goals_against+$2,
           wins=wins+$3,
           draws=draws+$4,
           losses=losses+$5,
           points=points+$6
           WHERE id=$7""",
        gf, ga, int(win), int(draw), int(loss), pts, team_id,
    )


# ─── Players ──────────────────────────────────────────────────────────────────
async def get_player_by_discord_id(discord_user_id: str) -> dict | None:
    row = await fetchrow(
        "SELECT * FROM players WHERE discord_user_id=$1 LIMIT 1", discord_user_id
    )
    return dict(row) if row else None


async def get_player_by_id(player_id: int) -> dict | None:
    row = await fetchrow("SELECT * FROM players WHERE id=$1", player_id)
    return dict(row) if row else None


async def get_team_squad(team_id: int) -> list[dict]:
    rows = await fetch(
        "SELECT * FROM players WHERE team_id=$1 ORDER BY rating DESC", team_id
    )
    return [dict(r) for r in rows]


async def get_lineup_players(team: dict) -> list[dict] | None:
    raw = team.get("lineup_player_ids")
    if not raw:
        return None
    try:
        ids: list[int] = json.loads(raw)
    except Exception:
        return None
    if not isinstance(ids, list) or len(ids) != 11:
        return None
    squad = await get_team_squad(team["id"])
    by_id = {p["id"]: p for p in squad}
    lineup = [by_id[i] for i in ids if i in by_id]
    return lineup if len(lineup) == 11 else None


async def top_scorers(limit: int = 15) -> list[dict]:
    rows = await fetch(
        """SELECT p.*, t.name as team_name, t.short_name as team_short
           FROM players p
           INNER JOIN teams t ON p.team_id=t.id
           WHERE p.goals > 0
           ORDER BY p.goals DESC, p.assists DESC
           LIMIT $1""",
        limit,
    )
    return [dict(r) for r in rows]


async def recent_matches(limit: int = 10) -> list[dict]:
    rows = await fetch(
        """SELECT m.*,
           ht.name as home_name, ht.short_name as home_short,
           at.name as away_name, at.short_name as away_short
           FROM matches m
           INNER JOIN teams ht ON m.home_team_id=ht.id
           INNER JOIN teams at ON m.away_team_id=at.id
           ORDER BY m.created_at DESC LIMIT $1""",
        limit,
    )
    return [dict(r) for r in rows]


async def insert_player(team_id: int, discord_user_id: str, guild_id: str | None,
                        name: str, position: str, gen: int = 55) -> dict:
    row = await fetchrow(
        """INSERT INTO players (team_id, discord_user_id, guild_id, name, position, rating)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *""",
        team_id, discord_user_id, guild_id, name, position, gen,
    )
    return dict(row)


async def update_player_team(player_id: int, team_id: int) -> dict:
    row = await fetchrow(
        "UPDATE players SET team_id=$1 WHERE id=$2 RETURNING *",
        team_id, player_id,
    )
    return dict(row)


async def set_player_gen(player_id: int, new_gen: int) -> dict:
    from config import MIN_GEN, MAX_GEN
    clamped = max(MIN_GEN, min(MAX_GEN, round(new_gen)))
    row = await fetchrow(
        "UPDATE players SET rating=$1 WHERE id=$2 RETURNING *",
        clamped, player_id,
    )
    return dict(row)


async def adjust_player_gen(player_id: int, delta: int) -> dict:
    p = await get_player_by_id(player_id)
    if not p:
        raise ValueError("Oyuncu bulunamadı")
    return await set_player_gen(player_id, p["rating"] + delta)


async def record_training(player: dict, guild_id: str) -> dict:
    """Returns dict with keys: amount, player, gained_gen, new_gen, trainings_since_gen, trainings_remaining."""
    from config import MAX_GEN, MIN_GEN, TRAININGS_PER_GEN
    amount = 1

    current_count = player["trainings_since_gen"]
    current_gen = player["rating"]
    new_count = current_count + amount
    gen_increases = new_count // TRAININGS_PER_GEN
    remainder = new_count % TRAININGS_PER_GEN
    target_gen = min(MAX_GEN, current_gen + gen_increases)
    actual_increase = target_gen - current_gen

    new_trainings = remainder if actual_increase > 0 else new_count

    updated = await fetchrow(
        """UPDATE players
           SET rating=$1, trainings_since_gen=$2, last_training_at=NOW()
           WHERE id=$3 RETURNING *""",
        target_gen, new_trainings, player["id"],
    )
    updated = dict(updated)

    pool = await get_pool()
    await pool.execute(
        """INSERT INTO trainings (player_id, discord_user_id, guild_id, amount, resulted_in_gen_increase)
           VALUES ($1,$2,$3,$4,$5)""",
        player["id"],
        player.get("discord_user_id", "unknown"),
        guild_id,
        amount,
        actual_increase,
    )

    final_count = updated["trainings_since_gen"]
    return {
        "amount": amount,
        "player": updated,
        "gained_gen": actual_increase > 0,
        "new_gen": updated["rating"],
        "trainings_since_gen": final_count,
        "trainings_remaining": TRAININGS_PER_GEN - final_count,
    }


async def apply_season_decay():
    from config import MIN_GEN, SEASON_END_GEN_DECAY
    result = await fetch(
        f"""UPDATE players
            SET rating=GREATEST(rating-{SEASON_END_GEN_DECAY},{MIN_GEN}),
                goals=0, assists=0, yellow_cards=0, red_cards=0,
                appearances=0, trainings_since_gen=0
            RETURNING id"""
    )
    return len(result)


async def all_players_with_discord() -> list[dict]:
    rows = await fetch("SELECT * FROM players WHERE discord_user_id IS NOT NULL")
    return [dict(r) for r in rows]


async def add_player_appearance(player_id: int):
    await execute("UPDATE players SET appearances=appearances+1 WHERE id=$1", player_id)


async def add_player_goal(player_id: int):
    await execute("UPDATE players SET goals=goals+1 WHERE id=$1", player_id)


async def add_player_assist(player_id: int):
    await execute("UPDATE players SET assists=assists+1 WHERE id=$1", player_id)


async def add_player_yellow_card(player_id: int):
    await execute("UPDATE players SET yellow_cards=yellow_cards+1 WHERE id=$1", player_id)


async def add_player_red_card(player_id: int):
    await execute("UPDATE players SET red_cards=red_cards+1 WHERE id=$1", player_id)


# ─── Matches ──────────────────────────────────────────────────────────────────
async def insert_match(home_team_id: int, away_team_id: int, home_score: int,
                       away_score: int, home_gpr: int, away_gpr: int,
                       home_tactic_score: int, away_tactic_score: int,
                       home_possession: int, home_shots: int, away_shots: int,
                       home_shots_on_target: int, away_shots_on_target: int,
                       narrative: str, events: list) -> dict:
    row = await fetchrow(
        """INSERT INTO matches
           (home_team_id,away_team_id,home_score,away_score,home_gpr,away_gpr,
            home_tactic_score,away_tactic_score,home_possession,home_shots,away_shots,
            home_shots_on_target,away_shots_on_target,narrative,events)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING *""",
        home_team_id, away_team_id, home_score, away_score, home_gpr, away_gpr,
        home_tactic_score, away_tactic_score, home_possession, home_shots, away_shots,
        home_shots_on_target, away_shots_on_target, narrative, json.dumps(events),
    )
    return dict(row)


async def delete_all_matches():
    await execute("DELETE FROM matches")


# ─── GEN Authorized Roles ─────────────────────────────────────────────────────
async def list_authorized_roles(guild_id: str) -> list[dict]:
    rows = await fetch(
        "SELECT * FROM gen_authorized_roles WHERE guild_id=$1", guild_id
    )
    return [dict(r) for r in rows]


async def add_authorized_role(guild_id: str, role_id: str):
    await execute(
        """INSERT INTO gen_authorized_roles (guild_id, role_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING""",
        guild_id, role_id,
    )


async def remove_authorized_role(guild_id: str, role_id: str):
    await execute(
        "DELETE FROM gen_authorized_roles WHERE guild_id=$1 AND role_id=$2",
        guild_id, role_id,
    )
