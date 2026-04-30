import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, teamSquad } from "../services/teams";
import { getTactic } from "../services/tactics";
import { errorEmbed, primaryEmbed, teamColor } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("takim-bilgi")
    .setDescription("Bir takımın tüm bilgilerini gösterir")
    .addStringOption((o) =>
      o.setName("takim").setDescription("Takım adı veya kısa adı").setRequired(true),
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
    const [squad, tactic] = await Promise.all([
      teamSquad(team.id),
      getTactic(team.id),
    ]);

    const gd = team.goalsFor - team.goalsAgainst;
    const embed = primaryEmbed(`${team.name} (${team.shortName})`)
      .setColor(teamColor(team.color))
      .addFields(
        {
          name: "📊 Baz Reyting",
          value: `**${team.baseRating}**`,
          inline: true,
        },
        { name: "👥 Kadro", value: `${squad.length} oyuncu`, inline: true },
        {
          name: "📋 Aktif Taktik",
          value: tactic
            ? `${tactic.formation} • Boost: **+${tactic.tacticScore}**`
            : "Standart 4-4-2 (+2)",
          inline: true,
        },
        {
          name: "🏆 Lig Sıralaması",
          value:
            `**${team.points}** puan • **${team.matchesPlayed}** maç\n` +
            `${team.wins} G - ${team.draws} B - ${team.losses} M\n` +
            `Averaj: ${gd >= 0 ? "+" : ""}${gd} (${team.goalsFor} A - ${team.goalsAgainst} Y)`,
          inline: false,
        },
      )
      .setFooter({ text: `Takım ID: ${team.id}` });

    if (squad.length > 0) {
      const top = squad.slice(0, 5);
      embed.addFields({
        name: "⭐ En İyi 5 Oyuncu",
        value: top
          .map((p) => `\`${p.position}\` **${p.name}** — ${p.rating}`)
          .join("\n"),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
