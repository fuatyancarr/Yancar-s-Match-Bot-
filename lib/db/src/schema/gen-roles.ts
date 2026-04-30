import {
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const genAuthorizedRolesTable = pgTable(
  "gen_authorized_roles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.roleId] }),
  }),
);

export type GenAuthorizedRole = typeof genAuthorizedRolesTable.$inferSelect;
