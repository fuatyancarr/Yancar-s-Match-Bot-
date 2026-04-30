import { db, teamsTable, playersTable, matchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { generateJson } from "./gemini";
import { getTacticForMatch, type TacticAnalysis } from "./tactics";
import { logger } from "../../lib/logger";
import type { Team, Player } from "@workspace/db";

export interface MatchEvent {
  minute: number;
  type: "GOL" | "ASIST" | "SARI_KART" | "KIRMIZI_KART" | "POZISYON" | "KURTARIS";
  team: "ev" | "deplasman";
  playerName: string;
  description: string;
  assistName?: string;
}

export interface MatchSimulationResult {
  homeScore: number;
  awayScore: number;
  homeGpr: number;
  awayGpr: number;
  homeTacticScore: number;
  awayTacticScore: number;
  homeTactic: TacticAnalysis;
  awayTactic: TacticAnalysis;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  events: MatchEvent[];
  narrative: string;
  goalScorers: { teamId: number; playerId: number; assistPlayerId?: number }[];
  cardEvents: { playerId: number; type: "yellow" | "red" }[];
  matchId: number;
}

const HOME_BONUS = 3;

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

function calculateExpectedGoals(ourGpr: number, theirGpr: number): number {
  const diff = ourGpr - theirGpr;
  const base = 1.35;
  const adjustment = diff * 0.06;
  return Math.max(0.2, base + adjustment);
}

function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function getOutfieldPlayers(squad: Player[]): Player[] {
  return squad.filter((p) => p.position.toUpperCase() !== "GK" && p.position.toUpperCase() !== "KL");
}

function pickScorer(squad: Player[]): Player | null {
  const outfield = getOutfieldPlayers(squad);
  if (outfield.length === 0) return null;
  const weights = outfield.map((p) => {
    const pos = p.position.toUpperCase();
    if (pos === "FWD" || pos === "FB") return p.rating * 3;
    if (pos === "MID" || pos === "OS") return p.rating * 1.5;
    return p.rating * 0.5;
  });
  return pickWeighted(outfield, weights);
}

function pickAssister(squad: Player[], scorer: Player): Player | null {
  const candidates = getOutfieldPlayers(squad).filter((p) => p.id !== scorer.id);
  if (candidates.length === 0) return null;
  const weights = candidates.map((p) => {
    const pos = p.position.toUpperCase();
    if (pos === "MID" || pos === "OS") return p.rating * 2.5;
    if (pos === "FWD" || pos === "FB") return p.rating * 1.5;
    return p.rating;
  });
  return pickWeighted(candidates, weights);
}

function pickRandomPlayer(squad: Player[]): Player | null {
  if (squad.length === 0) return null;
  const idx = Math.floor(Math.random() * squad.length);
  return squad[idx] ?? null;
}

interface SimContext {
  homeTeam: Team;
  awayTeam: Team;
  homeSquad: Player[];
  awaySquad: Player[];
  homeGpr: number;
  awayGpr: number;
  homeTactic: TacticAnalysis;
  awayTactic: TacticAnalysis;
}

function generateMatchEvents(ctx: SimContext): {
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homePossession: number;
  goalScorers: { teamId: number; playerId: number; assistPlayerId?: number }[];
  cardEvents: { playerId: number; type: "yellow" | "red" }[];
} {
  const { homeTeam, awayTeam, homeSquad, awaySquad, homeGpr, awayGpr } = ctx;

  const homeXg = calculateExpectedGoals(homeGpr, awayGpr);
  const awayXg = calculateExpectedGoals(awayGpr, homeGpr);

  const homeScore = Math.min(7, poissonSample(homeXg));
  const awayScore = Math.min(7, poissonSample(awayXg));

  const homeShots = Math.max(homeScore + 1, Math.round(homeXg * 6 + Math.random() * 4));
  const awayShots = Math.max(awayScore + 1, Math.round(awayXg * 6 + Math.random() * 4));
  const homeOnTarget = Math.max(homeScore, Math.round(homeShots * (0.35 + Math.random() * 0.2)));
  const awayOnTarget = Math.max(awayScore, Math.round(awayShots * (0.35 + Math.random() * 0.2)));

  const totalGpr = homeGpr + awayGpr;
  const homePossession = Math.max(
    35,
    Math.min(70, Math.round((homeGpr / totalGpr) * 100 + (Math.random() * 6 - 3))),
  );

  const events: MatchEvent[] = [];
  const goalScorers: { teamId: number; playerId: number; assistPlayerId?: number }[] = [];
  const cardEvents: { playerId: number; type: "yellow" | "red" }[] = [];

  const allMinutes = new Set<number>();
  function uniqueMinute(min = 1, max = 90): number {
    let attempts = 0;
    while (attempts < 50) {
      const m = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!allMinutes.has(m)) {
        allMinutes.add(m);
        return m;
      }
      attempts++;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  for (let i = 0; i < homeScore; i++) {
    const scorer = pickScorer(homeSquad);
    if (!scorer) break;
    const assister = Math.random() < 0.7 ? pickAssister(homeSquad, scorer) : null;
    const minute = uniqueMinute();
    events.push({
      minute,
      type: "GOL",
      team: "ev",
      playerName: scorer.name,
      assistName: assister?.name,
      description: assister
        ? `⚽ GOOOOL! ${scorer.name} ağları sarsıyor! ${assister.name}'ın asistiyle ${homeTeam.shortName} öne geçiyor!`
        : `⚽ GOOOOL! ${scorer.name} solo bir çıkışla muhteşem bir gol atıyor!`,
    });
    goalScorers.push({
      teamId: homeTeam.id,
      playerId: scorer.id,
      assistPlayerId: assister?.id,
    });
  }

  for (let i = 0; i < awayScore; i++) {
    const scorer = pickScorer(awaySquad);
    if (!scorer) break;
    const assister = Math.random() < 0.7 ? pickAssister(awaySquad, scorer) : null;
    const minute = uniqueMinute();
    events.push({
      minute,
      type: "GOL",
      team: "deplasman",
      playerName: scorer.name,
      assistName: assister?.name,
      description: assister
        ? `⚽ GOOOOL! Deplasmanda ${scorer.name}, ${assister.name}'ın pasıyla ${awayTeam.shortName}'ı öne geçiriyor!`
        : `⚽ GOOOOL! ${scorer.name} ${awayTeam.shortName} adına ağları havalandırıyor!`,
    });
    goalScorers.push({
      teamId: awayTeam.id,
      playerId: scorer.id,
      assistPlayerId: assister?.id,
    });
  }

  const yellowCount = Math.floor(Math.random() * 4) + 1;
  for (let i = 0; i < yellowCount; i++) {
    const isHome = Math.random() < 0.5;
    const player = pickRandomPlayer(isHome ? homeSquad : awaySquad);
    if (!player) continue;
    const minute = uniqueMinute();
    events.push({
      minute,
      type: "SARI_KART",
      team: isHome ? "ev" : "deplasman",
      playerName: player.name,
      description: `🟨 Sarı kart! ${player.name} hakem tarafından uyarıldı.`,
    });
    cardEvents.push({ playerId: player.id, type: "yellow" });
  }

  if (Math.random() < 0.12) {
    const isHome = Math.random() < 0.5;
    const player = pickRandomPlayer(isHome ? homeSquad : awaySquad);
    if (player) {
      const minute = uniqueMinute(40, 88);
      events.push({
        minute,
        type: "KIRMIZI_KART",
        team: isHome ? "ev" : "deplasman",
        playerName: player.name,
        description: `🟥 KIRMIZI KART! ${player.name} oyundan atıldı! Takım 10 kişi kaldı.`,
      });
      cardEvents.push({ playerId: player.id, type: "red" });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  return {
    events,
    homeScore,
    awayScore,
    homeShots,
    awayShots,
    homeOnTarget,
    awayOnTarget,
    homePossession,
    goalScorers,
    cardEvents,
  };
}

async function generateNarrative(
  ctx: SimContext,
  homeScore: number,
  awayScore: number,
): Promise<string> {
  const { homeTeam, awayTeam, homeGpr, awayGpr, homeTactic, awayTactic } = ctx;
  const prompt = `Sen tecrübeli bir Türk spor spikerisin. Aşağıdaki maç sonucu için kısa, akıcı, heyecanlı bir Türkçe maç özeti yaz (3-4 cümle, en fazla 600 karakter).

MAÇ:
- Ev sahibi: ${homeTeam.name} (${homeTeam.shortName}) — GPR: ${homeGpr}, Diziliş: ${homeTactic.formation}
- Deplasman: ${awayTeam.name} (${awayTeam.shortName}) — GPR: ${awayGpr}, Diziliş: ${awayTactic.formation}
- Skor: ${homeScore} - ${awayScore}

Spiker üslubuyla, özlü ve atmosferik yaz. Skoru, üstün gelen tarafı ve maçın tonunu (zorlu/kolay/sürpriz vb.) anlat. Sadece düz metin dön, başka hiçbir şey ekleme. Emoji kullanma.`;
  try {
    const res = await generateJson<{ narrative: string }>(
      prompt + "\n\nYANIT FORMATI: { \"narrative\": \"<özet metin>\" }",
    );
    return res.narrative.slice(0, 800);
  } catch (err) {
    logger.error({ err }, "Anlatım üretimi başarısız");
    if (homeScore > awayScore) {
      return `${homeTeam.name}, taraftarı önünde ${awayTeam.name}'ı ${homeScore}-${awayScore} mağlup etti. ${homeTeam.shortName}'ın ${homeTactic.formation} dizilişi sahaya hakim olurken, deplasman ekibi cevap verecek silahı bulamadı.`;
    } else if (awayScore > homeScore) {
      return `Sürpriz deplasmanda! ${awayTeam.name}, ${homeTeam.name}'ı kendi sahasında ${awayScore}-${homeScore} yenmeyi başardı. ${awayTeam.shortName}'ın disiplinli oyunu, ev sahibi atmosferine baskın geldi.`;
    } else {
      return `${homeTeam.name} ile ${awayTeam.name} ${homeScore}-${awayScore} berabere kaldı. İki takım da galibiyet için yüklendi ancak skor değişmedi.`;
    }
  }
}

export async function simulateMatch(
  homeTeamId: number,
  awayTeamId: number,
): Promise<MatchSimulationResult> {
  const [homeTeam, awayTeam] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, homeTeamId)).then((r) => r[0]),
    db.select().from(teamsTable).where(eq(teamsTable.id, awayTeamId)).then((r) => r[0]),
  ]);
  if (!homeTeam) throw new Error("Ev sahibi takım bulunamadı");
  if (!awayTeam) throw new Error("Deplasman takımı bulunamadı");

  const [homeSquad, awaySquad, homeTactic, awayTactic] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.teamId, homeTeamId)),
    db.select().from(playersTable).where(eq(playersTable.teamId, awayTeamId)),
    getTacticForMatch(homeTeamId),
    getTacticForMatch(awayTeamId),
  ]);

  if (homeSquad.length === 0)
    throw new Error(`${homeTeam.name} takımının kadrosunda oyuncu yok. Önce /oyuncu-ekle ile oyuncu ekleyin.`);
  if (awaySquad.length === 0)
    throw new Error(`${awayTeam.name} takımının kadrosunda oyuncu yok. Önce /oyuncu-ekle ile oyuncu ekleyin.`);

  const homeGpr = homeTeam.baseRating + HOME_BONUS + homeTactic.tacticScore;
  const awayGpr = awayTeam.baseRating + 0 + awayTactic.tacticScore;

  const ctx: SimContext = {
    homeTeam,
    awayTeam,
    homeSquad,
    awaySquad,
    homeGpr,
    awayGpr,
    homeTactic,
    awayTactic,
  };

  const sim = generateMatchEvents(ctx);
  const narrative = await generateNarrative(ctx, sim.homeScore, sim.awayScore);

  // Persist match
  const [inserted] = await db
    .insert(matchesTable)
    .values({
      homeTeamId,
      awayTeamId,
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      homeGpr,
      awayGpr,
      homeTacticScore: homeTactic.tacticScore,
      awayTacticScore: awayTactic.tacticScore,
      homePossession: sim.homePossession,
      homeShots: sim.homeShots,
      awayShots: sim.awayShots,
      homeShotsOnTarget: sim.homeOnTarget,
      awayShotsOnTarget: sim.awayOnTarget,
      narrative,
      events: JSON.stringify(sim.events),
    })
    .returning({ id: matchesTable.id });

  // Update team stats
  await applyMatchToStats({
    homeTeamId,
    awayTeamId,
    homeScore: sim.homeScore,
    awayScore: sim.awayScore,
  });

  // Update player stats
  await applyPlayerStats({
    homeSquad,
    awaySquad,
    goalScorers: sim.goalScorers,
    cardEvents: sim.cardEvents,
  });

  return {
    homeScore: sim.homeScore,
    awayScore: sim.awayScore,
    homeGpr,
    awayGpr,
    homeTacticScore: homeTactic.tacticScore,
    awayTacticScore: awayTactic.tacticScore,
    homeTactic,
    awayTactic,
    homePossession: sim.homePossession,
    homeShots: sim.homeShots,
    awayShots: sim.awayShots,
    homeShotsOnTarget: sim.homeOnTarget,
    awayShotsOnTarget: sim.awayOnTarget,
    events: sim.events,
    narrative,
    goalScorers: sim.goalScorers,
    cardEvents: sim.cardEvents,
    matchId: inserted!.id,
  };
}

async function applyMatchToStats(args: {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}) {
  const { homeTeamId, awayTeamId, homeScore, awayScore } = args;
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;
  const draw = homeScore === awayScore;

  await db
    .update(teamsTable)
    .set({
      matchesPlayed: sql`${teamsTable.matchesPlayed} + 1`,
      goalsFor: sql`${teamsTable.goalsFor} + ${homeScore}`,
      goalsAgainst: sql`${teamsTable.goalsAgainst} + ${awayScore}`,
      wins: homeWin ? sql`${teamsTable.wins} + 1` : teamsTable.wins,
      draws: draw ? sql`${teamsTable.draws} + 1` : teamsTable.draws,
      losses: awayWin ? sql`${teamsTable.losses} + 1` : teamsTable.losses,
      points: homeWin
        ? sql`${teamsTable.points} + 3`
        : draw
          ? sql`${teamsTable.points} + 1`
          : teamsTable.points,
    })
    .where(eq(teamsTable.id, homeTeamId));

  await db
    .update(teamsTable)
    .set({
      matchesPlayed: sql`${teamsTable.matchesPlayed} + 1`,
      goalsFor: sql`${teamsTable.goalsFor} + ${awayScore}`,
      goalsAgainst: sql`${teamsTable.goalsAgainst} + ${homeScore}`,
      wins: awayWin ? sql`${teamsTable.wins} + 1` : teamsTable.wins,
      draws: draw ? sql`${teamsTable.draws} + 1` : teamsTable.draws,
      losses: homeWin ? sql`${teamsTable.losses} + 1` : teamsTable.losses,
      points: awayWin
        ? sql`${teamsTable.points} + 3`
        : draw
          ? sql`${teamsTable.points} + 1`
          : teamsTable.points,
    })
    .where(eq(teamsTable.id, awayTeamId));
}

async function applyPlayerStats(args: {
  homeSquad: Player[];
  awaySquad: Player[];
  goalScorers: { teamId: number; playerId: number; assistPlayerId?: number }[];
  cardEvents: { playerId: number; type: "yellow" | "red" }[];
}) {
  const allPlayerIds = [
    ...args.homeSquad.map((p) => p.id),
    ...args.awaySquad.map((p) => p.id),
  ];
  for (const pid of allPlayerIds) {
    await db
      .update(playersTable)
      .set({ appearances: sql`${playersTable.appearances} + 1` })
      .where(eq(playersTable.id, pid));
  }
  for (const g of args.goalScorers) {
    await db
      .update(playersTable)
      .set({ goals: sql`${playersTable.goals} + 1` })
      .where(eq(playersTable.id, g.playerId));
    if (g.assistPlayerId) {
      await db
        .update(playersTable)
        .set({ assists: sql`${playersTable.assists} + 1` })
        .where(eq(playersTable.id, g.assistPlayerId));
    }
  }
  for (const c of args.cardEvents) {
    if (c.type === "yellow") {
      await db
        .update(playersTable)
        .set({ yellowCards: sql`${playersTable.yellowCards} + 1` })
        .where(eq(playersTable.id, c.playerId));
    } else {
      await db
        .update(playersTable)
        .set({ redCards: sql`${playersTable.redCards} + 1` })
        .where(eq(playersTable.id, c.playerId));
    }
  }
}
