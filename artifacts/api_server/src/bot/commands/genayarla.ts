import { SlashCommandBuilder } from "discord.js";
import { errorEmbed, successEmbed } from "../util/embeds";
import { requireGenAuthorized } from "../util/permissions";
import {
  getPlayerByDiscordId,
  setGen,
  syncPlayerNickname,
  MIN_GEN,
  MAX_GEN,
} from "../services/gen";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("genayarla")
    .setDescription(`Bir oyuncunun GEN'ini doğrudan ayarlar (${MIN_GEN}-${MAX_GEN}, GEN yetkili veya Yönetici)`)
    .addUserOption((o) =>
      o
        .setName("oyuncu")
        .setDescription("GEN'i ayarlanacak Discord kullanıcısı")
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("yeni-gen")
        .setDescription(`Yeni GEN değeri (${MIN_GEN}-${MAX_GEN})`)
        .setMinValue(MIN_GEN)
        .setMaxValue(MAX_GEN)
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireGenAuthorized(interaction))) return;
    const user = interaction.options.getUser("oyuncu", true);
    const newGen = interaction.options.getInteger("yeni-gen", true);
    const player = await getPlayerByDiscordId(user.id);
    if (!player) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Oyuncu Bulunamadı",
            `<@${user.id}> kayıtlı bir oyuncu değil.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
    const updated = await setGen(player.id, newGen);
    await syncPlayerNickname(interaction.guild, updated);
    await interaction.reply({
      embeds: [
        successEmbed(
          "GEN Ayarlandı",
          `<@${user.id}> **${updated.name}** → GEN: \`${player.gen}\` → \`${updated.gen}\``,
        ),
      ],
    });
  },
};
