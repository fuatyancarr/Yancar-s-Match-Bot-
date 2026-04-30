import { SlashCommandBuilder } from "discord.js";
import { db, teamsTable } from "@workspace/db";
import { requireAdmin } from "../util/permissions";
import { successEmbed, errorEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("takim-ekle")
    .setDescription("Lige yeni bir takım ekler (Sadece Yönetici)")
    .addStringOption((o) =>
      o.setName("isim").setDescription("Takımın tam adı (örn: Kocaelispor)").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("kisa-isim").setDescription("Takımın kısa adı (örn: KOC)").setRequired(true),
    )
    .addRoleOption((o) =>
      o
        .setName("rol")
        .setDescription("Takım Discord rolü (oyuncuların etiketleneceği rol)")
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("baz-reyting")
        .setDescription("Takımın baz reytingi (50-95)")
        .setMinValue(50)
        .setMaxValue(95)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("renk").setDescription("Takım rengi hex (örn: #1f4ea1)").setRequired(false),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const name = interaction.options.getString("isim", true).trim();
    const shortName = interaction.options.getString("kisa-isim", true).trim().toUpperCase();
    const role = interaction.options.getRole("rol", true);
    const baseRating = interaction.options.getInteger("baz-reyting", true);
    const colorRaw = interaction.options.getString("renk")?.trim() ?? "#1f4ea1";
    const color = colorRaw.startsWith("#") ? colorRaw : `#${colorRaw}`;

    try {
      const [team] = await db
        .insert(teamsTable)
        .values({
          name,
          shortName,
          discordRoleId: role.id,
          guildId: interaction.guildId,
          baseRating,
          color,
        })
        .returning();
      await interaction.reply({
        embeds: [
          successEmbed(
            "Takım Eklendi",
            `**${team!.name}** (${team!.shortName}) lige başarıyla eklendi.\n\n` +
              `📊 **Baz Reyting:** ${team!.baseRating}\n` +
              `🎨 **Renk:** ${team!.color}\n` +
              `🎭 **Rol:** <@&${role.id}> (\`${role.id}\`)\n` +
              `⚽ **Diziliş:** ${team!.formation}\n\n` +
              `🆔 Takım ID: \`${team!.id}\``,
          ),
        ],
      });
    } catch (err) {
      const msg = (err as Error).message;
      const isDup = msg.includes("unique") || msg.includes("duplicate");
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Takım Eklenemedi",
            isDup
              ? `Bu isimde veya kısa isimde bir takım zaten var: **${name}** / **${shortName}**`
              : `Hata: ${msg}`,
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
