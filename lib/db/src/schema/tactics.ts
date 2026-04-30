import {
  pgTable,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const tacticsTable = pgTable("tactics", {
  teamId: integer("team_id")
    .primaryKey()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  content: text("content").notNull(),
  tacticScore: integer("tactic_score").notNull().default(2),
  formation: text("formation").notNull().default("Belirsiz"),
  analysis: text("analysis").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Tactic = typeof tacticsTable.$inferSelect;
export type InsertTactic = typeof tacticsTable.$inferInsert;
