import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const trainingsTable = pgTable("trainings", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => playersTable.id, { onDelete: "cascade" }),
  discordUserId: text("discord_user_id").notNull(),
  guildId: text("guild_id").notNull(),
  amount: integer("amount").notNull(),
  resultedInGenIncrease: integer("resulted_in_gen_increase").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Training = typeof trainingsTable.$inferSelect;
export type InsertTraining = typeof trainingsTable.$inferInsert;
