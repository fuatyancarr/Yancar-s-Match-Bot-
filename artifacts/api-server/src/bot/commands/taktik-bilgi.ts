import { SlashCommandBuilder } from "discord.js";
import { findTeamByName } from "../services/teams";
import { getTactic } from "../services/tactics";
import { errorEmbed, primaryEmbed, infoEmbed, teamColor } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("taktik-bilgi")
    .setDescription("Bir takımın aktif taktiğini gösterir")
    .addStringOption((o) =>
      o.setName("takim").setDescription("Takım adı").setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString("takim", true);
    const team = await findTeamByName(query);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${query}\` adında bir takım yok.`)],
        ephemeral: true,
      });
      return;
    }
    const tactic = await getTactic(team.id);
    if (!tactic) {
      await interaction.reply({
        embeds: [
          infoEmbed(
            `${team.name} — Standart Taktik`,
            "Bu takım taktik dosyası yüklemediği için sistem **Standart 4-4-2 (+2)** taktiğini uygulayacak.\n\n" +
              "`/taktik-yukle` ile özel taktik yükleyebilirsiniz.",
          ),
        ],
      });
      return;
    }

    const embed = primaryEmbed(`${team.name} — Aktif Taktik`)
      .setColor(teamColor(team.color))
      .addFields(
        { name: "📁 Dosya", value: `\`${tactic.fileName}\``, inline: true },
        { name: "📐 Diziliş", value: tactic.formation, inline: true },
        { name: "🧠 Boost", value: `**+${tactic.tacticScore}** / 6`, inline: true },
        { name: "🤖 AI Analizi", value: tactic.analysis.slice(0, 1024) },
      )
      .setFooter({
        text: `Son güncelleme: ${tactic.updatedAt.toLocaleString("tr-TR")}`,
      });
    await interaction.reply({ embeds: [embed] });
  },
};
