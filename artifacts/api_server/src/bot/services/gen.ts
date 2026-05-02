import { db, playersTable, type Player } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { applyNickname, extractBaseName, fetchMember } from "./nickname";
import type { Guild } from "discord.js";

export const MIN_GEN = 0;
export const MAX_GEN = 120;
export const DEFAULT_START_GEN = 55;
export const TRAININGS_PER_GEN = 10;
export const TRAINING_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export const SEASON_END_GEN_DECAY = 15;

export function clampGen(value: number): number {
  return Math.max(MIN_GEN, Math.min(MAX_GEN, Math.round(value)));
}

export async function getPlayerByDiscordId(
  discordUserId: string,
): Promise<Player | null> {
  const rows = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.discordUserId, discordUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const rows = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function setGen(
  playerId: number,
  newGen: number,
): Promise<Player> {
  const clamped = clampGen(newGen);
  const [updated] = await db
    .update(playersTable)
    .set({ gen: clamped })
    .where(eq(playersTable.id, playerId))
    .returning();
  if (!updated) throw new Error("Oyuncu güncellenemedi");
  return updated;
}

export async function adjustGen(
  playerId: number,
  delta: number,
): Promise<Player> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Oyuncu bulunamadı");
  return setGen(playerId, player.gen + delta);
}

export async function syncPlayerNickname(
  guild: Guild | null | undefined,
  player: Player,
): Promise<void> {
  if (!guild || !player.discordUserId) return;
  const member = await fetchMember(guild, player.discordUserId);
  if (!member) return;
  const baseName =
    extractBaseName(member.displayName) ?? player.name ?? member.user.username;
  await applyNickname(member, baseName, player.gen, player.position);
}

export async function applySeasonEndDecay(): Promise<{
  affected: number;
}> {
  const result = await db
    .update(playersTable)
    .set({
      gen: sql`GREATEST(${playersTable.gen} - ${SEASON_END_GEN_DECAY}, ${MIN_GEN})`,
      trainingsSinceGen: 0,
    })
    .returning({ id: playersTable.id });
  return { affected: result.length };
}

export async function listAllPlayersWithDiscord(): Promise<Player[]> {
  return db.select().from(playersTable);
}
