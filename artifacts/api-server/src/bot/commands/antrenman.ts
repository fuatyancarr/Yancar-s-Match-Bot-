import { SlashCommandBuilder } from "discord.js";
import { errorEmbed, successEmbed, primaryEmbed } from "../util/embeds";
import {
  getPlayerByDiscordId,
  syncPlayerNickname,
  MAX_GEN,
  TRAININGS_PER_GEN,
} from "../services/gen";
import {
  recordTraining,
  getCooldownRemainingMs,
  formatCooldown,
} from "../services/training";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("antrenman")
    .setDescription("Bir saatte bir kez antrenman yapabilirsin (1-4 puan kazanırsın)"),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Kanal", "Bu komut sadece sunucuda kullanılabilir.")],
        ephemeral: true,
      });
      return;
    }
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: "Sunucu bulunamadı.", ephemeral: true });
      return;
    }

    const player = await getPlayerByDiscordId(interaction.user.id);
    if (!player) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Oyuncu Değilsin",
            "Antrenman yapmak için önce bir takıma kayıtlı oyuncu olman gerekiyor. Yöneticiden `/oyuncu-ekle` ile seni eklemesini iste.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (player.gen >= MAX_GEN) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Maksimum GEN",
            `**${player.name}** zaten **${MAX_GEN}** GEN'e ulaşmış. Daha fazla artmaz.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const cooldown = getCooldownRemainingMs(player.lastTrainingAt);
    if (cooldown > 0) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Antrenman Bekleme",
            `Henüz tekrar antrenman yapamazsın. Kalan süre: **${formatCooldown(cooldown)}**`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const result = await recordTraining(player, guildId);
    const oldGen = player.gen;
    const oldCount = player.trainingsSinceGen;

    if (result.gainedGen) {
      await syncPlayerNickname(interaction.guild, result.player);
    }

    const lines = [
      `🎲 Bu antrenmandan **${result.amount}** puan aldın!`,
      `📊 Toplam: \`${oldCount}\` + \`${result.amount}\` = \`${oldCount + result.amount}\` / ${TRAININGS_PER_GEN}`,
      ``,
    ];
    if (result.gainedGen) {
      lines.push(
        `🚀 **GEN ARTIŞI!** \`${oldGen}\` → \`${result.newGen}\``,
        `🎉 Tebrikler! Yeni GEN ile takma adın güncellendi.`,
      );
    } else {
      lines.push(
        `📈 Mevcut GEN: \`${result.player.gen}\``,
        `⏳ GEN artmak için **${result.trainingsRemaining}** antrenman daha gerekli.`,
      );
    }
    lines.push(``, `⏰ Bir sonraki antrenman: **1 saat** sonra`);

    const embed = result.gainedGen
      ? successEmbed(`🏋️ ${player.name} — Antrenman Tamamlandı`, lines.join("\n"))
      : primaryEmbed(`🏋️ ${player.name} — Antrenman Tamamlandı`).setDescription(lines.join("\n"));

    await interaction.editReply({ embeds: [embed] });
  },
};
