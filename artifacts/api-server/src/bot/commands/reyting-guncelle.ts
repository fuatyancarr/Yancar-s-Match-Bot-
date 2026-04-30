import { SlashCommandBuilder } from "discord.js";
import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findTeamByName } from "../services/teams";
import { requireAdmin } from "../util/permissions";
import { successEmbed, errorEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("reyting-guncelle")
    .setDescription("Bir takımın baz reytingini günceller (Sadece Yönetici)")
    .addStringOption((o) =>
      o.setName("takim").setDescription("Takım adı").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("yeni-reyting")
        .setDescription("Yeni baz reyting (50-95)")
        .setMinValue(50)
        .setMaxValue(95)
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const q = interaction.options.getString("takim", true);
    const newRating = interaction.options.getInteger("yeni-reyting", true);
    const team = await findTeamByName(q);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${q}\``)],
        ephemeral: true,
      });
      return;
    }
    await db
      .update(teamsTable)
      .set({ baseRating: newRating })
      .where(eq(teamsTable.id, team.id));
    await interaction.reply({
      embeds: [
        successEmbed(
          "Reyting Güncellendi",
          `**${team.name}** baz reytingi: \`${team.baseRating}\` → \`${newRating}\``,
        ),
      ],
    });
  },
};
