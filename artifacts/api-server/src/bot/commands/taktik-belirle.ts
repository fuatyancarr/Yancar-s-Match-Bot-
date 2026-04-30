import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, searchTeams } from "../services/teams";
import { setTeamFormation } from "../services/tactics";
import { requireAdmin } from "../util/permissions";
import { errorEmbed, successEmbed } from "../util/embeds";
import { formationChoices, findFormation } from "../util/formations";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("taktik-belirle")
    .setDescription("Bir takımın taktik dizilişini ayarlar (Sadece Yönetici)")
    .addStringOption((o) =>
      o
        .setName("takim")
        .setDescription("Takım adı")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName("dizilis")
        .setDescription("Diziliş seçimi")
        .setRequired(true)
        .addChoices(...formationChoices()),
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
    if (!(await requireAdmin(interaction))) return;
    const teamQ = interaction.options.getString("takim", true);
    const formationCode = interaction.options.getString("dizilis", true);
    const team = await findTeamByName(teamQ);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${teamQ}\``)],
        ephemeral: true,
      });
      return;
    }
    const f = findFormation(formationCode);
    if (!f) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Diziliş", formationCode)],
        ephemeral: true,
      });
      return;
    }
    const tactic = await setTeamFormation(team.id, f.code);
    await interaction.reply({
      embeds: [
        successEmbed(
          "Taktik Belirlendi",
          `**${team.name}** için yeni diziliş: **${f.label}**\n\n` +
            `📐 **Sistem:** ${f.code} (${f.style})\n` +
            `⚡ **Taktik Boostu:** +${f.tacticBoost}\n` +
            `📋 **Mevki Sayısı:** ${f.positionLayout.GK} GK / ${f.positionLayout.DEF} DEF / ${f.positionLayout.MID} MID / ${f.positionLayout.FWD} FWD\n\n` +
            `${tactic.analysis}`,
        ),
      ],
    });
  },
};
