import { SlashCommandBuilder } from "discord.js";
import { db, teamsTable, playersTable, matchesTable } from "@workspace/db";
import { requireAdmin } from "../util/permissions";
import { successEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("sezon-baslat")
    .setDescription("Yeni sezon başlatır: tüm istatistikleri sıfırlar (Sadece Yönetici)")
    .addBooleanOption((o) =>
      o
        .setName("onay")
        .setDescription("Tüm istatistikler sıfırlanacak. Onaylıyor musun?")
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const ok = interaction.options.getBoolean("onay", true);
    if (!ok) {
      await interaction.reply({
        content: "İşlem iptal edildi.",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();
    await db.delete(matchesTable);
    await db
      .update(teamsTable)
      .set({
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        matchesPlayed: 0,
      });
    await db
      .update(playersTable)
      .set({
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        appearances: 0,
      });
    await interaction.editReply({
      embeds: [
        successEmbed(
          "Yeni Sezon Başladı",
          "Tüm takım ve oyuncu istatistikleri sıfırlandı. Tüm maç geçmişi silindi. Bol şans! 🏆",
        ),
      ],
    });
  },
};
