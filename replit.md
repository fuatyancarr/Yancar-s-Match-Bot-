# Türk Ligi Discord Maç Botu

## Overview

Discord bot for simulating Turkish football league matches. Teams have base ratings; admins assign a standard formation (4-4-2, 4-3-3, 3-5-2, etc.) which gives a tactic boost (+1..+6). Matches use a GPR formula (Base Rating + Home Bonus + Tactic Boost) plus Poisson-based scoring. AI generates match narratives and extracts 11-player lineups from images.

## GPR Formula

`GPR = Base Rating + Home Bonus (+3 / 0) + Tactic Boost (+1..+6 from formation)`

## GEN System (player rating)

- Players start at **GEN 55**, max **GEN 120**, min **GEN 0**.
- Players use `/antrenman` once per hour and gain **1–4** training points (weighted toward 1–2).
- Every **10 training points = +1 GEN** (carry-over kept).
- Each season end (`/sezon-baslat`) all players lose **−15 GEN** (floored at 0) and `trainings_since_gen` resets.
- Authorized roles (configured via `/yetkili-rol`) plus admins may use `/genarttir`, `/gendusur`, `/genayarla`.

## Discord Nickname

Format: `İsim | GEN | MEVKİ` (e.g. `Ahmet | 67 | ST`), max 32 chars (name truncated to fit). Auto-applied on player add, transfer, GEN change, training-driven GEN gain. Bot needs `Manage Nicknames` permission.

## Positions (15)

- **GK**: GK
- **DEF**: CB, LB, RB, LWB, RWB
- **MID**: CDM, CM, CAM, LM, RM
- **FWD**: LW, RW, ST, CF

## Formations (13)

`4-4-2`, `4-4-2-D` (Diamond), `4-3-3`, `4-3-3-F` (False 9), `4-2-3-1`, `4-1-4-1`, `4-5-1`, `3-5-2`, `3-4-3`, `3-4-1-2`, `5-3-2`, `5-4-1`, `4-1-2-1-2` — each carries a tactic boost (+1..+6) and style (Hücum/Defans/Dengeli/Modern).

## Match Lineup Requirement

Before `/mac-yap` runs, both teams must have a saved 11-player lineup. Admins use `/kadro-ekle <takım> <görsel>`: Gemini Vision extracts player names + formation from the uploaded image (formation diagram, screenshot, or list), fuzzy-matches against the team squad, then saves the 11-player lineup + formation.

## Stack

- **Bot**: Python 3.11, discord.py 2.x, 21 slash commands (Turkish), autocomplete on team options
- **AI**: Gemini 2.5 Flash via Replit AI Integrations (text + vision) — `ai_client.py`
- **Database**: PostgreSQL via asyncpg — `db.py`
- **Runtime**: Python 3.11, single-process with asyncio
- **HTTP**: aiohttp minimal health check on `PORT` (`/api/healthz`)

## Schema (PostgreSQL tables)

- `teams` — name, short_name, discord_role_id, guild_id, base_rating, color, formation, lineup_player_ids (JSON), season stats
- `players` — team_id, discord_user_id, guild_id, name, position (15 codes), rating (=GEN, starts 55), trainings_since_gen, last_training_at, goals/assists/cards/appearances
- `trainings` — player_id, discord_user_id, guild_id, amount (1–4), resulted_in_gen_increase, created_at
- `gen_authorized_roles` — guild_id + role_id (unique together)
- `matches` — full simulation history with events JSON

## Discord Slash Commands (21)

Public (9):
- `/yardim`, `/takim-listesi`, `/takim-bilgi`, `/kadro`, `/taktik-bilgi`, `/puan-tablosu`, `/gol-krallari`, `/son-maclar`, `/antrenman`

GEN-authorized or admin (3):
- `/genarttir`, `/gendusur`, `/genayarla`

Admin only (9):
- `/takim-ekle`, `/oyuncu-ekle`, `/transfer`, `/reyting-guncelle`, `/taktik-belirle`, `/kadro-ekle` (AI image), `/mac-yap`, `/sezon-baslat`, `/yetkili-rol ekle/cikar/listele`

## File Layout

```
artifacts/api-server/
├── main.py              — bot entry point, cog loader, aiohttp health server
├── config.py            — GEN constants, 15 positions, 13 formations
├── db.py                — all asyncpg database queries
├── ai_client.py         — Gemini Vision + text via Replit proxy
├── cogs/
│   ├── public.py        — 9 public commands
│   ├── training_gen.py  — /genarttir, /gendusur, /genayarla
│   └── admin.py         — 9 admin commands + yetkili-rol group
├── services/
│   ├── match.py         — Poisson match simulation
│   └── lineup.py        — AI image lineup extraction + fuzzy matching
└── utils/
    ├── embeds.py        — Discord embed helpers
    ├── permissions.py   — admin + GEN-authorized role checks
    └── nickname.py      — "İsim | GEN | POS" formatter
```

## Secrets

- `DISCORD_BOT_TOKEN` — Discord bot token (ManageNicknames permission required)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY` — Replit AI Integrations
- `DATABASE_URL` — Replit Postgres

## Key Commands

- `pip install discord.py asyncpg google-generativeai aiohttp` — install Python deps
- `python3 artifacts/api-server/main.py` — run bot locally
