import { SlashCommandBuilder } from "discord.js";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findTeamByName } from "../services/teams";
import { requireAdmin } from "../util/permissions";
import { successEmbed, errorEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Bir oyuncuyu başka takıma transfer eder (Sadece Yönetici)")
    .addIntegerOption((o) =>
      o.setName("oyuncu-id").setDescription("Oyuncu ID").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("yeni-takim").setDescription("Yeni takım adı").setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const playerId = interaction.options.getInteger("oyuncu-id", true);
    const teamQ = interaction.options.getString("yeni-takim", true);

    const team = await findTeamByName(teamQ);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${teamQ}\``)],
        ephemeral: true,
      });
      return;
    }
    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, playerId));
    if (!player) {
      await interaction.reply({
        embeds: [errorEmbed("Oyuncu Bulunamadı", `ID: \`${playerId}\``)],
        ephemeral: true,
      });
      return;
    }

    await db
      .update(playersTable)
      .set({ teamId: team.id })
      .where(eq(playersTable.id, playerId));

    await interaction.reply({
      embeds: [
        successEmbed(
          "Transfer Tamamlandı",
          `**${player.name}** artık **${team.name}** kadrosunda.`,
        ),
      ],
    });
  },
};
