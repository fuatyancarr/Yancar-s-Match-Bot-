import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  findFormation,
  getFormationOrDefault,
  type Formation,
  DEFAULT_FORMATION,
} from "../util/formations";

export interface TacticAnalysis {
  tacticScore: number;
  formation: string;
  formationLabel: string;
  style: string;
  analysis: string;
}

function formationToAnalysis(f: Formation): TacticAnalysis {
  const desc: Record<string, string> = {
    Hücum:
      "Yüksek pres ve geniş hücum açıları. Kanat bekleri sürekli ileri çıkar, orta saha üçlüsü/dörtlüsü pas trafiğini hızlandırır.",
    Defans:
      "Sıkı defansif blok ve kontra ataklara odaklı plan. Top kaybedildiğinde hızlı geri dönüş ve dar alan savunması esas alınır.",
    Dengeli:
      "Dengeli hücum/defans dağılımı. Hem topa sahip olarak hem de hızlı geçişlerle gol arar.",
    Modern:
      "Hibrit sistem. Top sahipliği yüksek, oyun kurucu derinden başlatır, ileride pres üçgenleri kurulur.",
  };
  return {
    tacticScore: f.tacticBoost,
    formation: f.code,
    formationLabel: f.label,
    style: f.style,
    analysis: desc[f.style] ?? "Standart taktik planı.",
  };
}

export function getStandardTactic(): TacticAnalysis {
  return formationToAnalysis(getFormationOrDefault(DEFAULT_FORMATION));
}

export async function setTeamFormation(
  teamId: number,
  formationCode: string,
): Promise<TacticAnalysis> {
  const f = findFormation(formationCode);
  if (!f) throw new Error(`Geçersiz diziliş kodu: ${formationCode}`);
  await db
    .update(teamsTable)
    .set({ formation: f.code })
    .where(eq(teamsTable.id, teamId));
  return formationToAnalysis(f);
}

export async function getTacticForMatch(teamId: number): Promise<TacticAnalysis> {
  const rows = await db
    .select({ formation: teamsTable.formation })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  const code = rows[0]?.formation ?? DEFAULT_FORMATION;
  return formationToAnalysis(getFormationOrDefault(code));
}
