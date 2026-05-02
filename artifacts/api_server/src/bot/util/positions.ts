export interface Position {
  code: string;
  label: string;
  category: "GK" | "DEF" | "MID" | "FWD";
}

export const POSITIONS: Position[] = [
  { code: "GK", label: "Kaleci", category: "GK" },
  { code: "CB", label: "Stoper", category: "DEF" },
  { code: "LB", label: "Sol Bek", category: "DEF" },
  { code: "RB", label: "Sağ Bek", category: "DEF" },
  { code: "LWB", label: "Sol Kanat Bek", category: "DEF" },
  { code: "RWB", label: "Sağ Kanat Bek", category: "DEF" },
  { code: "CDM", label: "Defansif Orta Saha", category: "MID" },
  { code: "CM", label: "Orta Saha", category: "MID" },
  { code: "CAM", label: "Hücum Orta Saha", category: "MID" },
  { code: "LM", label: "Sol Orta Saha", category: "MID" },
  { code: "RM", label: "Sağ Orta Saha", category: "MID" },
  { code: "LW", label: "Sol Açık Kanat", category: "FWD" },
  { code: "RW", label: "Sağ Açık Kanat", category: "FWD" },
  { code: "ST", label: "Forvet", category: "FWD" },
  { code: "CF", label: "Santrafor", category: "FWD" },
];

export const POSITION_CODES: string[] = POSITIONS.map((p) => p.code);

export function findPosition(code: string): Position | null {
  const c = code.toUpperCase().trim();
  return POSITIONS.find((p) => p.code === c) ?? null;
}

export function positionCategory(code: string): "GK" | "DEF" | "MID" | "FWD" {
  const p = findPosition(code);
  return p ? p.category : "MID";
}

export function positionChoices() {
  return POSITIONS.map((p) => ({
    name: `${p.label} (${p.code})`,
    value: p.code,
  }));
}

export const POSITION_ICONS: Record<"GK" | "DEF" | "MID" | "FWD", string> = {
  GK: "🧤",
  DEF: "🛡️",
  MID: "⚙️",
  FWD: "⚔️",
};
