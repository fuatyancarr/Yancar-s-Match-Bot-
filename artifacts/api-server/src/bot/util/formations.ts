export interface Formation {
  code: string;
  label: string;
  tacticBoost: number;
  style: "Hücum" | "Defans" | "Dengeli" | "Modern";
  positionLayout: { GK: number; DEF: number; MID: number; FWD: number };
}

export const FORMATIONS: Formation[] = [
  {
    code: "4-4-2",
    label: "4-4-2 Klasik",
    tacticBoost: 3,
    style: "Dengeli",
    positionLayout: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  },
  {
    code: "4-4-2-D",
    label: "4-4-2 Diamond",
    tacticBoost: 4,
    style: "Modern",
    positionLayout: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  },
  {
    code: "4-3-3",
    label: "4-3-3 Hücum",
    tacticBoost: 5,
    style: "Hücum",
    positionLayout: { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  },
  {
    code: "4-3-3-F",
    label: "4-3-3 (False 9)",
    tacticBoost: 4,
    style: "Modern",
    positionLayout: { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  },
  {
    code: "4-2-3-1",
    label: "4-2-3-1 Modern",
    tacticBoost: 5,
    style: "Modern",
    positionLayout: { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  },
  {
    code: "4-1-4-1",
    label: "4-1-4-1 Dengeli",
    tacticBoost: 3,
    style: "Dengeli",
    positionLayout: { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  },
  {
    code: "4-5-1",
    label: "4-5-1 Defansif",
    tacticBoost: 2,
    style: "Defans",
    positionLayout: { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  },
  {
    code: "3-5-2",
    label: "3-5-2 Klasik",
    tacticBoost: 4,
    style: "Hücum",
    positionLayout: { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  },
  {
    code: "3-4-3",
    label: "3-4-3 Hücum",
    tacticBoost: 6,
    style: "Hücum",
    positionLayout: { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  },
  {
    code: "3-4-1-2",
    label: "3-4-1-2",
    tacticBoost: 4,
    style: "Modern",
    positionLayout: { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  },
  {
    code: "5-3-2",
    label: "5-3-2 Defansif",
    tacticBoost: 2,
    style: "Defans",
    positionLayout: { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  },
  {
    code: "5-4-1",
    label: "5-4-1 Çok Defansif",
    tacticBoost: 1,
    style: "Defans",
    positionLayout: { GK: 1, DEF: 5, MID: 4, FWD: 1 },
  },
  {
    code: "4-1-2-1-2",
    label: "4-1-2-1-2 Diamond",
    tacticBoost: 4,
    style: "Modern",
    positionLayout: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  },
];

export function findFormation(code: string): Formation | null {
  const c = code.trim();
  return FORMATIONS.find((f) => f.code === c) ?? null;
}

export function formationChoices() {
  return FORMATIONS.map((f) => ({
    name: `${f.label} • +${f.tacticBoost}`,
    value: f.code,
  }));
}

export const DEFAULT_FORMATION = "4-4-2";

export function getFormationOrDefault(code: string | null | undefined): Formation {
  return findFormation(code ?? "") ?? findFormation(DEFAULT_FORMATION)!;
}
