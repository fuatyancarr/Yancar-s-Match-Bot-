import { db, tacticsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateJson } from "./gemini";
import { logger } from "../../lib/logger";

export interface TacticAnalysis {
  tacticScore: number;
  formation: string;
  analysis: string;
}

const STANDARD_ANALYSIS: TacticAnalysis = {
  tacticScore: 2,
  formation: "Standart 4-4-2",
  analysis:
    "Takım taktik dosyası göndermediği için sistem standart 4-4-2 dizilişi ve dengeli oyun planı atadı. Bu standart taktik +2 boost sağlar.",
};

export async function getStandardTactic(): Promise<TacticAnalysis> {
  return STANDARD_ANALYSIS;
}

export async function analyzeTactic(
  tacticContent: string,
  fileName: string,
  teamName: string,
): Promise<TacticAnalysis> {
  const trimmed = tacticContent.trim();
  if (!trimmed) {
    return {
      ...STANDARD_ANALYSIS,
      analysis: "Boş taktik dosyası gönderildi, standart taktik uygulanacak.",
    };
  }

  const prompt = `Sen bir futbol taktik analistisin. ${teamName} takımının "${fileName}" isimli taktik dosyasını analiz edeceksin.

TAKTİK DOSYASI İÇERİĞİ:
"""
${trimmed.slice(0, 6000)}
"""

DEĞERLENDİRME KRİTERLERİ (0-6 puan):
- Diziliş netliği ve dengesi (örn: 4-3-3, 4-2-3-1, 3-5-2)
- Oyuncu rolleri ve görevleri (santrfor, bek, on numara vb.)
- Hücum talimatları (pres, kontra, top kontrolü)
- Defansif organizasyon (alan, adam adama, ofsayt çizgisi)
- Set parça (korner, taç, frikik) talimatları
- Genel yaratıcılık ve detay seviyesi

PUANLAMA SKALASI:
- 0: Hiçbir taktik bilgisi yok, anlamsız
- 1: Sadece diziliş yazılmış, başka detay yok
- 2: Standart, temel düzey taktik
- 3: Diziliş + bazı oyuncu rolleri var
- 4: İyi seviye, hücum/defans planı net
- 5: Çok iyi, set parça talimatları dahil her şey detaylı
- 6: Mükemmel, profesyonel düzeyde, yaratıcı ve eksiksiz

YANIT FORMATI (kesinlikle bu JSON yapısında dön, başka hiçbir şey ekleme):
{
  "tacticScore": <0-6 arası tam sayı>,
  "formation": "<Tespit edilen diziliş, örn: 4-3-3 veya Belirsiz>",
  "analysis": "<Türkçe, 2-4 cümle taktik değerlendirmesi. Güçlü ve zayıf yönleri belirt.>"
}`;

  try {
    const result = await generateJson<TacticAnalysis>(prompt);
    const score = Math.max(0, Math.min(6, Math.round(Number(result.tacticScore) || 0)));
    return {
      tacticScore: score,
      formation: result.formation || "Belirsiz",
      analysis: result.analysis || "Analiz oluşturulamadı.",
    };
  } catch (err) {
    logger.error({ err, teamName }, "Taktik analizi başarısız");
    return {
      ...STANDARD_ANALYSIS,
      analysis:
        "Taktik analizi sırasında bir sorun oluştu, standart taktik uygulanacak.",
    };
  }
}

export async function saveTactic(
  teamId: number,
  fileName: string,
  content: string,
  analysis: TacticAnalysis,
): Promise<void> {
  await db
    .insert(tacticsTable)
    .values({
      teamId,
      fileName,
      content,
      tacticScore: analysis.tacticScore,
      formation: analysis.formation,
      analysis: analysis.analysis,
    })
    .onConflictDoUpdate({
      target: tacticsTable.teamId,
      set: {
        fileName,
        content,
        tacticScore: analysis.tacticScore,
        formation: analysis.formation,
        analysis: analysis.analysis,
        updatedAt: new Date(),
      },
    });
}

export async function getTactic(teamId: number) {
  const rows = await db
    .select()
    .from(tacticsTable)
    .where(eq(tacticsTable.teamId, teamId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTacticForMatch(
  teamId: number,
): Promise<TacticAnalysis & { isStandard: boolean; fileName: string | null }> {
  const t = await getTactic(teamId);
  if (!t) {
    return { ...STANDARD_ANALYSIS, isStandard: true, fileName: null };
  }
  return {
    tacticScore: t.tacticScore,
    formation: t.formation,
    analysis: t.analysis,
    isStandard: false,
    fileName: t.fileName,
  };
}
