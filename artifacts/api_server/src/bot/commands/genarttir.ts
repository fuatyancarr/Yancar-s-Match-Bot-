import { SlashCommandBuilder } from "discord.js";
import { errorEmbed, successEmbed } from "../util/embeds";
import { requireGenAuthorized } from "../util/permissions";
import {
  getPlayerByDiscordId,
  adjustGen,
  syncPlayerNickname,
  MAX_GEN,
} from "../services/gen";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("genarttir")
    .setDescription("Etiketlenen oyuncunun GEN'ini +1 arttırır (GEN yetkili veya Yönetici)")
    .addUserOption((o) =>
      o
        .setName("oyuncu")
        .setDescription("GEN'i arttırılacak Discord kullanıcısı")
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireGenAuthorized(interaction))) return;
    const user = interaction.options.getUser("oyuncu", true);
    const player = await getPlayerByDiscordId(user.id);
    if (!player) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Oyuncu Bulunamadı",
            `<@${user.id}> kayıtlı bir oyuncu değil. Önce \`/oyuncu-ekle\` ile eklenmeli.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
    if (player.gen >= MAX_GEN) {
      await interaction.reply({
        embeds: [
          errorEmbed("Maksimum GEN", `**${player.name}** zaten ${MAX_GEN} GEN'e ulaşmış.`),
        ],
        ephemeral: true,
      });
      return;
    }
    const updated = await adjustGen(player.id, +1);
    await syncPlayerNickname(interaction.guild, updated);
    await interaction.reply({
      embeds: [
        successEmbed(
          "GEN Arttırıldı",
          `<@${user.id}> **${updated.name}** → GEN: \`${player.gen}\` → \`${updated.gen}\` (+1)`,
        ),
      ],
    });
  },
};
