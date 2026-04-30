import { SlashCommandBuilder } from "discord.js";
import { eq } from "drizzle-orm";
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
    .addUserOption((o) =>
      o
        .setName("kullanici")
        .setDescription("Oyuncu olacak Discord kullanıcısı (etiket veya ID)")
        .setRequired(true),
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
    )
    .addStringOption((o) =>
      o
        .setName("isim")
        .setDescription("Opsiyonel: özel oyuncu adı (boşsa Discord adı kullanılır)")
        .setRequired(false),
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

    const user = interaction.options.getUser("kullanici", true);
    const position = interaction.options.getString("pozisyon", true);
    const rating = interaction.options.getInteger("reyting", true);
    const customName = interaction.options.getString("isim", false)?.trim();

    if (!POSITIONS.includes(position)) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Pozisyon", `Pozisyon: ${POSITIONS.join(", ")}`)],
        ephemeral: true,
      });
      return;
    }

    const existing = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.discordUserId, user.id))
      .limit(1);
    if (existing.length > 0) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Kullanıcı Zaten Kayıtlı",
            `<@${user.id}> zaten bir oyuncu olarak kayıtlı (\`${existing[0]!.name}\`, ID: \`${existing[0]!.id}\`).`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    let displayName: string | null = null;
    try {
      const member = await interaction.guild?.members.fetch(user.id);
      displayName = member?.displayName ?? null;
    } catch {
      displayName = null;
    }
    const name = customName || displayName || user.displayName || user.username;

    const [player] = await db
      .insert(playersTable)
      .values({
        teamId: team.id,
        discordUserId: user.id,
        name,
        position,
        rating,
      })
      .returning();

    await interaction.reply({
      embeds: [
        successEmbed(
          "Oyuncu Eklendi",
          `<@${user.id}> → **${player!.name}** \`${player!.position}\` (${player!.rating})\n` +
            `**${team.name}** kadrosuna katıldı.\n\n` +
            `🆔 Oyuncu ID: \`${player!.id}\`\n` +
            `👤 Discord ID: \`${user.id}\``,
        ),
      ],
    });
  },
};
