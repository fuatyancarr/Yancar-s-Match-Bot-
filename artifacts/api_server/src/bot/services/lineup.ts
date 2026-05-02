import { db, teamsTable, playersTable, type Player, type Team } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai, FLASH_MODEL } from "./gemini";
import { logger } from "../../lib/logger";
import { getFormationOrDefault } from "../util/formations";

export interface LineupExtraction {
  formation: string | null;
  playerNames: string[];
  rawAnalysis: string;
}

const VISION_PROMPT = `Bu bir futbol takımının 11 kişilik kadro/diziliş görseli. Görseldeki tüm oyuncuların adlarını ve dizilişini çıkar.

Görselde olabilecekler:
- Diziliş diyagramı (formasyon)
- Oyuncu isimleri listesi
- FIFA/PES/eFootball gibi oyun ekran görüntüsü
- Takım fotoğrafı altında isimler

KURALLAR:
- En az 11, en fazla 11 oyuncu adı bul
- Diziliş formatı: "4-4-2", "4-3-3", "4-2-3-1" vb.
- Oyuncu adları olabildiğince doğru/eksiksiz yazılsın
- Diziliş tespit edilemiyorsa null dön

YANIT FORMATI (sadece bu JSON, başka hiçbir şey ekleme):
{
  "formation": "4-3-3" veya null,
  "playerNames": ["Ad1", "Ad2", ..., "Ad11"],
  "rawAnalysis": "Görseli kısaca tarif et (Türkçe, 1-2 cümle)"
}`;

export async function extractLineupFromImage(
  imageUrl: string,
  contentType: string | null,
): Promise<LineupExtraction> {
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`Görsel indirilemedi (${resp.status})`);
  }
  const arrayBuf = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mimeType = contentType ?? "image/png";

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: VISION_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      temperature: 0.4,
    },
  });

  const text = response.text ?? "";
  if (!text) throw new Error("Gemini görsel analizinde boş yanıt döndü");
  let parsed: { formation: string | null; playerNames: string[]; rawAnalysis: string };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`AI yanıtı JSON olarak ayrıştırılamadı: ${(e as Error).message}`);
  }
  const names = Array.isArray(parsed.playerNames)
    ? parsed.playerNames.filter((n) => typeof n === "string" && n.trim().length > 0)
    : [];
  return {
    formation: typeof parsed.formation === "string" ? parsed.formation.trim() : null,
    playerNames: names,
    rawAnalysis: typeof parsed.rawAnalysis === "string" ? parsed.rawAnalysis : "",
  };
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyScore(a: string, b: string): number {
  const aN = normalizeName(a);
  const bN = normalizeName(b);
  if (!aN || !bN) return 0;
  if (aN === bN) return 100;
  if (aN.includes(bN) || bN.includes(aN)) return 80;
  const aTokens = aN.split(" ");
  const bTokens = bN.split(" ");
  let matches = 0;
  for (const t of aTokens) {
    if (t.length >= 3 && bTokens.some((x) => x === t || x.startsWith(t) || t.startsWith(x))) {
      matches++;
    }
  }
  if (matches === 0) return 0;
  return Math.round((matches / Math.max(aTokens.length, bTokens.length)) * 70);
}

export interface MatchedLineup {
  matched: { extractedName: string; player: Player; score: number }[];
  unmatched: string[];
}

export function matchPlayersToSquad(
  extractedNames: string[],
  squad: Player[],
): MatchedLineup {
  const matched: { extractedName: string; player: Player; score: number }[] = [];
  const unmatched: string[] = [];
  const usedPlayerIds = new Set<number>();

  for (const name of extractedNames) {
    let best: { player: Player; score: number } | null = null;
    for (const p of squad) {
      if (usedPlayerIds.has(p.id)) continue;
      const score = fuzzyScore(name, p.name);
      if (score > 0 && (!best || score > best.score)) {
        best = { player: p, score };
      }
    }
    if (best && best.score >= 50) {
      matched.push({ extractedName: name, player: best.player, score: best.score });
      usedPlayerIds.add(best.player.id);
    } else {
      unmatched.push(name);
    }
  }
  return { matched, unmatched };
}

export async function saveLineup(
  teamId: number,
  playerIds: number[],
  formation: string,
): Promise<void> {
  if (playerIds.length !== 11) {
    throw new Error(`Kadroda 11 oyuncu olmalı, ${playerIds.length} oyuncu verildi`);
  }
  const f = getFormationOrDefault(formation);
  await db
    .update(teamsTable)
    .set({
      lineupPlayerIds: JSON.stringify(playerIds),
      lineupSetAt: new Date(),
      formation: f.code,
    })
    .where(eq(teamsTable.id, teamId));
}

export async function getLineup(team: Team): Promise<Player[] | null> {
  if (!team.lineupPlayerIds) return null;
  let ids: number[];
  try {
    ids = JSON.parse(team.lineupPlayerIds);
  } catch {
    logger.warn({ teamId: team.id }, "Geçersiz kadro JSON");
    return null;
  }
  if (!Array.isArray(ids) || ids.length !== 11) return null;
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.teamId, team.id));
  const lineup: Player[] = [];
  for (const id of ids) {
    const p = players.find((x) => x.id === id);
    if (p) lineup.push(p);
  }
  return lineup.length === 11 ? lineup : null;
}

export async function clearLineup(teamId: number): Promise<void> {
  await db
    .update(teamsTable)
    .set({ lineupPlayerIds: null, lineupSetAt: null })
    .where(eq(teamsTable.id, teamId));
}
