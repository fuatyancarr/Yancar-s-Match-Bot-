import { SlashCommandBuilder } from "discord.js";
import { leagueTable } from "../services/teams";
import { primaryEmbed, infoEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("puan-tablosu")
    .setDescription("Lig puan tablosunu gösterir"),
  async execute(interaction) {
    const teams = await leagueTable();
    if (teams.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed("Lig Boş", "Henüz takım eklenmemiş.")],
      });
      return;
    }
    const header =
      "```\n# Takım           O   G  B  M   AV   P\n```";
    const rows = teams
      .map((t, i) => {
        const gd = t.goalsFor - t.goalsAgainst;
        const pad = (s: string | number, n: number) => String(s).padEnd(n);
        const padL = (s: string | number, n: number) => String(s).padStart(n);
        return `\`${padL(i + 1, 2)} ${pad(t.shortName, 6)} ${padL(t.matchesPlayed, 3)} ${padL(t.wins, 2)} ${padL(t.draws, 2)} ${padL(t.losses, 2)} ${padL((gd >= 0 ? "+" : "") + gd, 4)} ${padL(t.points, 3)}\``;
      })
      .join("\n");

    const embed = primaryEmbed("🏆 Lig Puan Tablosu", header + "\n" + rows.slice(0, 3800))
      .setFooter({ text: "O: Oyun • G: Galibiyet • B: Beraberlik • M: Mağlubiyet • AV: Averaj • P: Puan" });
    await interaction.reply({ embeds: [embed] });
  },
};
