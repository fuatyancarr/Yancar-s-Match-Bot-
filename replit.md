# Türk Ligi Discord Maç Botu

## Overview

Discord bot for simulating Turkish football league matches. Teams have base ratings; admins assign a standard formation (4-4-2, 4-3-3, 3-5-2, etc.) which gives a tactic boost (+1..+6). Matches use a GPR formula (Base Rating + Home Bonus + Tactic Boost) plus Poisson-based scoring. AI generates match narratives and extracts 11-player lineups from images.

## GPR Formula

`GPR = Base Rating + Home Bonus (+3 / 0) + Tactic Boost (+1..+6 from formation)`

## GEN System (player rating)

- Players start at **GEN 55**, max **GEN 120**, min **GEN 0**.
- Players use `/antrenman` once per hour and gain **1–4** training points (weighted toward 1–2).
- Every **10 training points = +1 GEN** (carry-over kept).
- Each season end (`/sezon-baslat`) all players lose **−15 GEN** (floored at 0) and `trainingsSinceGen` resets.
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

Before `/mac-yap` runs, both teams must have a saved 11-player lineup. Admins use `/kadro-ekle <takım> <görsel>`: Gemini Vision extracts player names + formation from the uploaded image (formation diagram, screenshot, or list), fuzzy-matches against the team squad, then saves the 11-player lineup + formation. Match scoring/event weights use position categories on `players.gen`.

## Stack

- **Bot**: discord.js v14, slash commands (Turkish), autocomplete on team options
- **AI**: Gemini 2.5 Flash via Replit AI Integrations (text + vision)
- **Database**: PostgreSQL + Drizzle ORM
- **Runtime**: Node.js 24, esbuild bundle
- **HTTP**: Express 5 (just a `/api/healthz` endpoint)

## Schema (lib/db/src/schema)

- `teams` — name, shortName, **discordRoleId**, **guildId**, baseRating, color, **formation**, **lineupPlayerIds** (JSON), **lineupSetAt**, season stats
- `players` — teamId, discordUserId, **guildId**, name, position (15 codes), **gen** (DB column kept as `rating` 55 default), **trainingsSinceGen**, **lastTrainingAt**, goals/assists/cards/appearances
- `trainings` — playerId, discordUserId, guildId, amount (1–4), resultedInGenIncrease, createdAt
- `gen_authorized_roles` — guildId + roleId (unique together)
- `tactics` — legacy table, kept in DB but no longer used by the bot
- `matches` — full simulation history with events JSON

## Discord Slash Commands (21)

Public:
- `/yardim`, `/takim-listesi`, `/takim-bilgi`, `/kadro`, `/taktik-bilgi`, `/puan-tablosu`, `/gol-krallari`, `/son-maclar`, `/antrenman`

GEN-authorized (or admin):
- `/genarttir`, `/gendusur`, `/genayarla`

Admin only (Manage Server / Administrator):
- `/takim-ekle` (requires Discord role), `/oyuncu-ekle` (requires position), `/transfer`, `/reyting-guncelle`, `/taktik-belirle`, `/kadro-ekle` (image-based AI), `/mac-yap` (requires lineups), `/sezon-baslat` (-15 GEN), `/yetkili-rol ekle/cikar/listele`

All team options use autocomplete from the squad/team table.

## Key Commands

- `pnpm install --no-frozen-lockfile` — install deps
- `pnpm run typecheck:libs && pnpm --filter @workspace/api-server run typecheck` — full typecheck
- `pnpm --filter @workspace/db run push` — push DB schema

## File Layout

- `artifacts/api-server/src/index.ts` — boots Express + Discord client
- `artifacts/api-server/src/bot/index.ts` — Discord client wiring, dispatches both ChatInput + Autocomplete interactions
- `artifacts/api-server/src/bot/registry.ts` — registers all 21 slash commands
- `artifacts/api-server/src/bot/commands/` — one file per command
- `artifacts/api-server/src/bot/services/match.ts` — Poisson sim using `players.gen` & position category
- `artifacts/api-server/src/bot/services/tactics.ts` — formation → tactic boost mapping
- `artifacts/api-server/src/bot/services/lineup.ts` — Gemini Vision lineup extraction + fuzzy player matching
- `artifacts/api-server/src/bot/services/training.ts` — training cooldown + GEN gain logic
- `artifacts/api-server/src/bot/services/gen.ts` — GEN constants/helpers + season decay
- `artifacts/api-server/src/bot/services/nickname.ts` — `İsim | GEN | POS` formatter
- `artifacts/api-server/src/bot/util/positions.ts` — 15 positions + categories
- `artifacts/api-server/src/bot/util/formations.ts` — 13 formations + tactic boosts
- `artifacts/api-server/src/bot/util/permissions.ts` — admin + GEN-authorized role checks

## Secrets

- `DISCORD_BOT_TOKEN` — Discord bot token (must have ManageNicknames intent)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY` — set by Replit AI Integrations
- `DATABASE_URL` — Replit Postgres
- `SESSION_SECRET` — express session secret
