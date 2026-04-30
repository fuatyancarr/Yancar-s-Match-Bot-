import { db, playersTable, trainingsTable, type Player } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  TRAININGS_PER_GEN,
  TRAINING_COOLDOWN_MS,
  MAX_GEN,
} from "./gen";

export interface TrainingResult {
  amount: number;
  player: Player;
  gainedGen: boolean;
  newGen: number;
  trainingsSinceGen: number;
  trainingsRemaining: number;
}

function rollTrainingAmount(): number {
  // 1-4, weighted toward 1-2
  const r = Math.random();
  if (r < 0.4) return 1;
  if (r < 0.75) return 2;
  if (r < 0.95) return 3;
  return 4;
}

export function getCooldownRemainingMs(
  lastTrainingAt: Date | null | undefined,
): number {
  if (!lastTrainingAt) return 0;
  const diff = Date.now() - new Date(lastTrainingAt).getTime();
  return Math.max(0, TRAINING_COOLDOWN_MS - diff);
}

export function formatCooldown(ms: number): string {
  if (ms <= 0) return "şu an müsait";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} saniye`;
  return `${min} dakika ${sec} saniye`;
}

export async function recordTraining(
  player: Player,
  guildId: string,
): Promise<TrainingResult> {
  const amount = rollTrainingAmount();
  const newCount = player.trainingsSinceGen + amount;
  const genIncreases = Math.floor(newCount / TRAININGS_PER_GEN);
  const remainder = newCount % TRAININGS_PER_GEN;
  const targetGen = Math.min(MAX_GEN, player.gen + genIncreases);
  const actualIncrease = targetGen - player.gen;

  const [updated] = await db
    .update(playersTable)
    .set({
      gen: targetGen,
      trainingsSinceGen: actualIncrease > 0 ? remainder : newCount,
      lastTrainingAt: new Date(),
    })
    .where(eq(playersTable.id, player.id))
    .returning();

  await db.insert(trainingsTable).values({
    playerId: player.id,
    discordUserId: player.discordUserId ?? "unknown",
    guildId,
    amount,
    resultedInGenIncrease: actualIncrease,
  });

  if (!updated) throw new Error("Oyuncu güncellenemedi");

  const finalCount = updated.trainingsSinceGen;
  return {
    amount,
    player: updated,
    gainedGen: actualIncrease > 0,
    newGen: updated.gen,
    trainingsSinceGen: finalCount,
    trainingsRemaining: TRAININGS_PER_GEN - finalCount,
  };
}

export async function getTrainingHistory(
  playerId: number,
  limit = 10,
): Promise<{ amount: number; createdAt: Date; resultedInGenIncrease: number }[]> {
  return db
    .select({
      amount: trainingsTable.amount,
      createdAt: trainingsTable.createdAt,
      resultedInGenIncrease: trainingsTable.resultedInGenIncrease,
    })
    .from(trainingsTable)
    .where(eq(trainingsTable.playerId, playerId))
    .orderBy(sql`${trainingsTable.createdAt} DESC`)
    .limit(limit);
}
