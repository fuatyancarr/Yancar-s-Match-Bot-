import { SlashCommandBuilder } from "discord.js";
import {
  findTeamByName,
  searchTeams,
  teamSquad,
  sortBySquadPosition,
} from "../services/teams";
import { getTacticForMatch } from "../services/tactics";
import { getLineup } from "../services/lineup";
import { errorEmbed, primaryEmbed, teamColor } from "../util/embeds";
import { findFormation } from "../util/formations";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("takim-bilgi")
    .setDescription("Bir takımın tüm bilgilerini gösterir")
    .addStringOption((o) =>
      o
        .setName("takim")
        .setDescription("Takım adı veya kısa adı")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "takim") return;
    const teams = await searchTeams(String(focused.value), 25);
    await interaction.respond(
      teams.map((t) => ({ name: `${t.name} (${t.shortName})`, value: t.name })),
    );
  },
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
    const [squad, tactic, lineup] = await Promise.all([
      teamSquad(team.id),
      getTacticForMatch(team.id),
      getLineup(team),
    ]);

    const gd = team.goalsFor - team.goalsAgainst;
    const formation = findFormation(team.formation);
    const avgGen =
      squad.length > 0
        ? Math.round(squad.reduce((a, p) => a + p.gen, 0) / squad.length)
        : 0;

    const embed = primaryEmbed(`${team.name} (${team.shortName})`)
      .setColor(teamColor(team.color))
      .setDescription(
        team.discordRoleId ? `🏷️ Takım Rolü: <@&${team.discordRoleId}>` : null,
      )
      .addFields(
        { name: "📊 Baz Reyting", value: `**${team.baseRating}**`, inline: true },
        {
          name: "👥 Kadro",
          value: `${squad.length} oyuncu (Ort. GEN: ${avgGen})`,
          inline: true,
        },
        {
          name: "📋 Diziliş",
          value: `${formation?.label ?? team.formation} (+${tactic.tacticScore})`,
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
        {
          name: "🟢 Maç Kadrosu",
          value: lineup
            ? `Hazır (11/11) • ${formation?.label ?? team.formation}`
            : "⚠️ Ayarlanmamış (`/kadro-ekle`)",
          inline: false,
        },
      )
      .setFooter({ text: `Takım ID: ${team.id}` });

    if (squad.length > 0) {
      const top = sortBySquadPosition(squad).slice(0, 5);
      embed.addFields({
        name: "⭐ Öne Çıkan Oyuncular",
        value: top
          .map((p) => `\`${p.gen}\` \`${p.position}\` **${p.name}** — ${p.goals}G ${p.assists}A`)
          .join("\n"),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
