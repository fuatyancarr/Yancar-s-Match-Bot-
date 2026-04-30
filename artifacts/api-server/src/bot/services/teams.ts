import { db, teamsTable, playersTable } from "@workspace/db";
import { eq, ilike, or, desc, sql } from "drizzle-orm";

export async function findTeamByName(query: string) {
  const q = query.trim();
  if (!q) return null;

  const exact = await db
    .select()
    .from(teamsTable)
    .where(or(eq(teamsTable.name, q), eq(teamsTable.shortName, q)))
    .limit(1);
  if (exact[0]) return exact[0];

  const fuzzy = await db
    .select()
    .from(teamsTable)
    .where(
      or(
        ilike(teamsTable.name, `%${q}%`),
        ilike(teamsTable.shortName, `%${q}%`),
      ),
    )
    .limit(1);
  return fuzzy[0] ?? null;
}

export async function listTeams() {
  return db.select().from(teamsTable).orderBy(desc(teamsTable.baseRating));
}

export async function searchTeams(query: string, limit = 25) {
  const q = query.trim();
  if (!q) return listTeams().then((r) => r.slice(0, limit));
  return db
    .select()
    .from(teamsTable)
    .where(
      or(
        ilike(teamsTable.name, `%${q}%`),
        ilike(teamsTable.shortName, `%${q}%`),
      ),
    )
    .limit(limit);
}

export async function leagueTable() {
  return db
    .select()
    .from(teamsTable)
    .orderBy(
      desc(teamsTable.points),
      desc(sql`${teamsTable.goalsFor} - ${teamsTable.goalsAgainst}`),
      desc(teamsTable.goalsFor),
    );
}

export async function topScorers(limit = 10) {
  const rows = await db
    .select({
      player: playersTable,
      teamName: teamsTable.name,
      teamShort: teamsTable.shortName,
    })
    .from(playersTable)
    .innerJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .orderBy(desc(playersTable.goals), desc(playersTable.assists))
    .limit(limit);
  return rows.filter((r) => r.player.goals > 0);
}

export async function teamSquad(teamId: number) {
  return db
    .select()
    .from(playersTable)
    .where(eq(playersTable.teamId, teamId))
    .orderBy(desc(playersTable.rating));
}

const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  KL: 0,
  DEF: 1,
  DF: 1,
  MID: 2,
  OS: 2,
  FWD: 3,
  FB: 3,
};

export function sortBySquadPosition<T extends { position: string }>(arr: T[]) {
  return [...arr].sort(
    (a, b) =>
      (POSITION_ORDER[a.position.toUpperCase()] ?? 99) -
      (POSITION_ORDER[b.position.toUpperCase()] ?? 99),
  );
}
