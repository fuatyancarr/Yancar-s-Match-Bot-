import { SlashCommandBuilder } from "discord.js";
import { topScorers } from "../services/teams";
import { primaryEmbed, infoEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("gol-krallari")
    .setDescription("En çok gol atan oyuncuları listeler"),
  async execute(interaction) {
    const list = await topScorers(15);
    if (list.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed("Henüz Gol Yok", "Hiç maç oynanmamış.")],
      });
      return;
    }
    const lines = list.map((row, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
      return `${medal} **${row.player.name}** _(${row.teamShort})_ — **${row.player.goals}** gol, ${row.player.assists} asist`;
    });
    await interaction.reply({
      embeds: [primaryEmbed("👑 Gol Kralları", lines.join("\n"))],
    });
  },
};
