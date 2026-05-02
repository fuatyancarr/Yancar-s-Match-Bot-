import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, searchTeams } from "../services/teams";
import { getTacticForMatch } from "../services/tactics";
import { errorEmbed, primaryEmbed, teamColor } from "../util/embeds";
import { findFormation } from "../util/formations";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("taktik-bilgi")
    .setDescription("Bir takımın aktif taktik dizilişini gösterir")
    .addStringOption((o) =>
      o
        .setName("takim")
        .setDescription("Takım adı")
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
    const teamQ = interaction.options.getString("takim", true);
    const team = await findTeamByName(teamQ);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${teamQ}\``)],
        ephemeral: true,
      });
      return;
    }
    const tactic = await getTacticForMatch(team.id);
    const f = findFormation(team.formation);
    const embed = primaryEmbed(`📋 ${team.name} — Taktik`)
      .setColor(teamColor(team.color))
      .setDescription(
        `**Diziliş:** ${tactic.formationLabel}\n` +
          `**Stil:** ${tactic.style}\n` +
          `**Taktik Boostu:** +${tactic.tacticScore}\n\n` +
          `${tactic.analysis}` +
          (f
            ? `\n\n📐 ${f.positionLayout.GK} Kaleci • ${f.positionLayout.DEF} Defans • ${f.positionLayout.MID} Orta Saha • ${f.positionLayout.FWD} Forvet`
            : ""),
      );
    await interaction.reply({ embeds: [embed] });
  },
};
