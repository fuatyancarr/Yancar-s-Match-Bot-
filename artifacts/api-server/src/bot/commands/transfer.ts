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
    .addUserOption((o) =>
      o
        .setName("oyuncu")
        .setDescription("Transfer edilecek Discord kullanıcısı (etiket veya ID)")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("yeni-takim").setDescription("Yeni takım adı").setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const user = interaction.options.getUser("oyuncu", true);
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
      .where(eq(playersTable.discordUserId, user.id));
    if (!player) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Oyuncu Bulunamadı",
            `<@${user.id}> bir oyuncu olarak kayıtlı değil. Önce \`/oyuncu-ekle\` ile ekleyin.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (player.teamId === team.id) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Aynı Takım",
            `**${player.name}** zaten **${team.name}** kadrosunda.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await db
      .update(playersTable)
      .set({ teamId: team.id })
      .where(eq(playersTable.id, player.id));

    await interaction.reply({
      embeds: [
        successEmbed(
          "Transfer Tamamlandı",
          `<@${user.id}> **${player.name}** artık **${team.name}** kadrosunda.`,
        ),
      ],
    });
  },
};
