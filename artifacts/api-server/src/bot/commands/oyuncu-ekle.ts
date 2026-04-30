import { SlashCommandBuilder } from "discord.js";
import { db, playersTable } from "@workspace/db";
import { findTeamByName } from "../services/teams";
import { requireAdmin } from "../util/permissions";
import { successEmbed, errorEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

const POSITIONS = ["GK", "DEF", "MID", "FWD"];

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("oyuncu-ekle")
    .setDescription("Bir takıma oyuncu ekler (Sadece Yönetici)")
    .addStringOption((o) =>
      o.setName("takim").setDescription("Hangi takıma").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("isim").setDescription("Oyuncunun adı").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("pozisyon")
        .setDescription("Oyuncunun pozisyonu")
        .setRequired(true)
        .addChoices(
          { name: "Kaleci (GK)", value: "GK" },
          { name: "Defans (DEF)", value: "DEF" },
          { name: "Orta Saha (MID)", value: "MID" },
          { name: "Forvet (FWD)", value: "FWD" },
        ),
    )
    .addIntegerOption((o) =>
      o
        .setName("reyting")
        .setDescription("Oyuncu reytingi (50-95)")
        .setMinValue(50)
        .setMaxValue(95)
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const query = interaction.options.getString("takim", true);
    const team = await findTeamByName(query);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${query}\` adında bir takım yok.`)],
        ephemeral: true,
      });
      return;
    }
    const name = interaction.options.getString("isim", true).trim();
    const position = interaction.options.getString("pozisyon", true);
    const rating = interaction.options.getInteger("reyting", true);

    if (!POSITIONS.includes(position)) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Pozisyon", `Pozisyon: ${POSITIONS.join(", ")}`)],
        ephemeral: true,
      });
      return;
    }

    const [player] = await db
      .insert(playersTable)
      .values({ teamId: team.id, name, position, rating })
      .returning();

    await interaction.reply({
      embeds: [
        successEmbed(
          "Oyuncu Eklendi",
          `**${player!.name}** \`${player!.position}\` (${player!.rating}) ` +
            `**${team.name}** kadrosuna katıldı.\n\n🆔 Oyuncu ID: \`${player!.id}\``,
        ),
      ],
    });
  },
};
