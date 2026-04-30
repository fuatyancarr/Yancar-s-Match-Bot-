import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, teamSquad, sortBySquadPosition } from "../services/teams";
import { errorEmbed, primaryEmbed, teamColor, infoEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

const POS_ICON: Record<string, string> = {
  GK: "🧤",
  DEF: "🛡️",
  MID: "⚙️",
  FWD: "⚔️",
};

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("kadro")
    .setDescription("Bir takımın kadrosunu gösterir")
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

    const grouped: Record<string, typeof squad> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const p of squad) {
      const k = p.position.toUpperCase();
      if (grouped[k]) grouped[k]!.push(p);
    }

    const embed = primaryEmbed(`${team.name} — Kadro (${squad.length})`)
      .setColor(teamColor(team.color))
      .setDescription(
        `📊 Baz reyting: **${team.baseRating}** • Ortalama: **${Math.round(squad.reduce((a, p) => a + p.rating, 0) / squad.length)}**`,
      );

    for (const pos of ["GK", "DEF", "MID", "FWD"]) {
      const list = grouped[pos];
      if (!list || list.length === 0) continue;
      embed.addFields({
        name: `${POS_ICON[pos] ?? ""} ${pos} (${list.length})`,
        value: list
          .map(
            (p) =>
              `\`${p.rating}\` **${p.name}**${p.discordUserId ? ` (<@${p.discordUserId}>)` : ""} — ${p.goals}G ${p.assists}A`,
          )
          .join("\n")
          .slice(0, 1024),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
