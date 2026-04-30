import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  awayTeamId: integer("away_team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  homeGpr: integer("home_gpr").notNull(),
  awayGpr: integer("away_gpr").notNull(),
  homeTacticScore: integer("home_tactic_score").notNull(),
  awayTacticScore: integer("away_tactic_score").notNull(),
  homePossession: integer("home_possession").notNull().default(50),
  homeShots: integer("home_shots").notNull().default(0),
  awayShots: integer("away_shots").notNull().default(0),
  homeShotsOnTarget: integer("home_shots_on_target").notNull().default(0),
  awayShotsOnTarget: integer("away_shots_on_target").notNull().default(0),
  narrative: text("narrative").notNull(),
  events: text("events").notNull(),
  playedAt: timestamp("played_at").notNull().defaultNow(),
});

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
