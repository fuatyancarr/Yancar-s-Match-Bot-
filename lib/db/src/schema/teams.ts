import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const teamsTable = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    discordRoleId: text("discord_role_id"),
    guildId: text("guild_id"),
    baseRating: integer("base_rating").notNull().default(70),
    color: text("color").notNull().default("#1f4ea1"),
    formation: text("formation").notNull().default("4-4-2"),
    lineupPlayerIds: text("lineup_player_ids"),
    lineupSetAt: timestamp("lineup_set_at"),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    points: integer("points").notNull().default(0),
    matchesPlayed: integer("matches_played").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("teams_name_unique").on(t.name),
    shortNameIdx: uniqueIndex("teams_short_name_unique").on(t.shortName),
  }),
);

export type Team = typeof teamsTable.$inferSelect;
export type InsertTeam = typeof teamsTable.$inferInsert;
