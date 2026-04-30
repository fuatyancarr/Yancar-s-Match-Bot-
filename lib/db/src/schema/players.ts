import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  discordUserId: text("discord_user_id"),
  name: text("name").notNull(),
  position: text("position").notNull(),
  rating: integer("rating").notNull().default(70),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  yellowCards: integer("yellow_cards").notNull().default(0),
  redCards: integer("red_cards").notNull().default(0),
  appearances: integer("appearances").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
export type InsertPlayer = typeof playersTable.$inferInsert;
