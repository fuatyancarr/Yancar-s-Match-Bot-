import { SlashCommandBuilder } from "discord.js";
import {
  findTeamByName,
  searchTeams,
  teamSquad,
  sortBySquadPosition,
} from "../services/teams";
import { getLineup } from "../services/lineup";
import { findFormation } from "../util/formations";
import { positionCategory, POSITION_ICONS } from "../util/positions";
import {
  errorEmbed,
  primaryEmbed,
  teamColor,
  infoEmbed,
} from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("kadro")
    .setDescription("Bir takımın kadrosunu ve aktif maç kadrosunu gösterir")
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
    const query = interaction.options.getString("takim", true);
    const team = await findTeamByName(query);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${query}\` adında bir takım yok.`)],
        ephemeral: true,
      });
      return;
    }
    const squad = sortBySquadPosition(await teamSquad(team.id));
    if (squad.length === 0) {
      await interaction.reply({
        embeds: [
          infoEmbed(
            `${team.name} Kadrosu`,
            "Bu takımda henüz oyuncu yok. `/oyuncu-ekle` ile oyuncu ekleyin.",
          ),
        ],
      });
      return;
    }

    const grouped: Record<"GK" | "DEF" | "MID" | "FWD", typeof squad> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const p of squad) {
      grouped[positionCategory(p.position)].push(p);
    }

    const lineup = await getLineup(team);
    const formation = findFormation(team.formation);
    const avgGen = Math.round(squad.reduce((a, p) => a + p.gen, 0) / squad.length);

    const embed = primaryEmbed(`${team.name} — Tüm Oyuncular (${squad.length})`)
      .setColor(teamColor(team.color))
      .setDescription(
        `📊 Baz reyting: **${team.baseRating}** • Ortalama GEN: **${avgGen}**\n` +
          `📋 Diziliş: **${formation?.label ?? team.formation}** (+${formation?.tacticBoost ?? 0})\n` +
          (lineup
            ? `✅ Maç kadrosu hazır (11/11)`
            : `⚠️ Maç kadrosu ayarlanmamış. \`/kadro-ekle\` kullanın.`),
      );

    for (const cat of ["GK", "DEF", "MID", "FWD"] as const) {
      const list = grouped[cat];
      if (list.length === 0) continue;
      embed.addFields({
        name: `${POSITION_ICONS[cat]} ${cat} (${list.length})`,
        value: list
          .map(
            (p) =>
              `\`${p.gen}\` \`${p.position}\` **${p.name}**${p.discordUserId ? ` (<@${p.discordUserId}>)` : ""} — ${p.goals}G ${p.assists}A`,
          )
          .join("\n")
          .slice(0, 1024),
        inline: false,
      });
    }

    if (lineup) {
      const lineupText = lineup
        .map((p, i) => `${i + 1}. \`${p.position}\` ${p.name} (G${p.gen})`)
        .join("\n")
        .slice(0, 1024);
      embed.addFields({
        name: `🟢 Aktif Maç Kadrosu (${formation?.label ?? team.formation})`,
        value: lineupText,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
