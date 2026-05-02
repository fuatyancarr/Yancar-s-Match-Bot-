import { SlashCommandBuilder } from "discord.js";
import { db, teamsTable, playersTable, matchesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../util/permissions";
import { successEmbed } from "../util/embeds";
import { SEASON_END_GEN_DECAY, MIN_GEN, listAllPlayersWithDiscord, syncPlayerNickname } from "../services/gen";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("sezon-baslat")
    .setDescription("Yeni sezon: tüm istatistikler sıfırlanır, oyuncular -15 GEN alır (Sadece Yönetici)")
    .addBooleanOption((o) =>
      o
        .setName("onay")
        .setDescription(`Tüm istatistikler sıfırlanacak ve tüm oyunculara -${SEASON_END_GEN_DECAY} GEN uygulanacak.`)
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const ok = interaction.options.getBoolean("onay", true);
    if (!ok) {
      await interaction.reply({ content: "İşlem iptal edildi.", ephemeral: true });
      return;
    }
    await interaction.deferReply();

    await db.delete(matchesTable);

    await db.update(teamsTable).set({
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      matchesPlayed: 0,
      lineupPlayerIds: null,
      lineupSetAt: null,
    });

    const decayResult = await db
      .update(playersTable)
      .set({
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        appearances: 0,
        gen: sql`GREATEST(${playersTable.gen} - ${SEASON_END_GEN_DECAY}, ${MIN_GEN})`,
        trainingsSinceGen: 0,
      })
      .returning({ id: playersTable.id });

    // Sync nicknames asynchronously (don't await all to keep response fast)
    const players = await listAllPlayersWithDiscord();
    let synced = 0;
    for (const p of players) {
      if (p.discordUserId) {
        await syncPlayerNickname(interaction.guild, p);
        synced++;
      }
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "🏆 Yeni Sezon Başladı",
          `Tüm takım ve oyuncu istatistikleri sıfırlandı. Tüm maç geçmişi silindi.\n\n` +
            `📉 **${decayResult.length}** oyuncuya **-${SEASON_END_GEN_DECAY}** GEN uygulandı.\n` +
            `✏️ **${synced}** oyuncunun Discord takma adı güncellendi.\n\n` +
            `Bol şans! ⚽`,
        ),
      ],
    });
  },
};
