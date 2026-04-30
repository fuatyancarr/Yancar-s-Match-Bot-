import { SlashCommandBuilder } from "discord.js";
import { listTeams } from "../services/teams";
import { primaryEmbed, infoEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("takim-listesi")
    .setDescription("Tüm takımları baz reyting sırasına göre listeler"),
  async execute(interaction) {
    const teams = await listTeams();
    if (teams.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed("Takım Yok", "Henüz lige takım eklenmemiş. `/takim-ekle` ile başla.")],
      });
      return;
    }
    const lines = teams.map(
      (t, i) =>
        `**${i + 1}.** ${t.name} (${t.shortName}) — Reyting: \`${t.baseRating}\``,
    );
    const embed = primaryEmbed(
      `🏟️ Lig Takımları (${teams.length})`,
      lines.join("\n"),
    );
    await interaction.reply({ embeds: [embed] });
  },
};
