import { SlashCommandBuilder } from "discord.js";
import { db, matchesTable, teamsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { primaryEmbed, infoEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("son-maclar")
    .setDescription("Son oynanan maçları gösterir"),
  async execute(interaction) {
    const homeTeams = teamsTable;
    const matches = await db
      .select({
        match: matchesTable,
      })
      .from(matchesTable)
      .orderBy(desc(matchesTable.playedAt))
      .limit(10);

    if (matches.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed("Maç Yok", "Henüz hiç maç oynanmadı.")],
      });
      return;
    }

    const teamIds = new Set<number>();
    for (const m of matches) {
      teamIds.add(m.match.homeTeamId);
      teamIds.add(m.match.awayTeamId);
    }
    const teams = await db.select().from(homeTeams);
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const lines = matches.map((m) => {
      const h = teamMap.get(m.match.homeTeamId);
      const a = teamMap.get(m.match.awayTeamId);
      return `\`#${m.match.id}\` **${h?.shortName ?? "?"}** ${m.match.homeScore} - ${m.match.awayScore} **${a?.shortName ?? "?"}**`;
    });

    await interaction.reply({
      embeds: [primaryEmbed("📅 Son Maçlar", lines.join("\n"))],
    });
  },
};
