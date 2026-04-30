import { SlashCommandBuilder } from "discord.js";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { findTeamByName, searchTeams } from "../services/teams";
import { requireAdmin } from "../util/permissions";
import { successEmbed, errorEmbed } from "../util/embeds";
import { positionChoices, findPosition } from "../util/positions";
import { applyNickname, fetchMember } from "../services/nickname";
import { DEFAULT_START_GEN } from "../services/gen";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("oyuncu-ekle")
    .setDescription("Bir takıma oyuncu ekler (Sadece Yönetici)")
    .addStringOption((o) =>
      o
        .setName("takim")
        .setDescription("Eklenecek takım")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addUserOption((o) =>
      o
        .setName("kullanici")
        .setDescription("Oyuncu olacak Discord kullanıcısı (etiket veya ID)")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("mevki")
        .setDescription("Oyuncunun mevkii")
        .setRequired(true)
        .addChoices(...positionChoices()),
    )
    .addStringOption((o) =>
      o
        .setName("isim")
        .setDescription("Opsiyonel: özel oyuncu adı (boşsa Discord adı kullanılır)")
        .setRequired(false),
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "takim") return;
    const teams = await searchTeams(String(focused.value), 25);
    await interaction.respond(
      teams.map((t) => ({
        name: `${t.name} (${t.shortName})`,
        value: t.name,
      })),
    );
  },
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
    const positionCode = interaction.options.getString("mevki", true);
    const customName = interaction.options.getString("isim", false)?.trim();

    const position = findPosition(positionCode);
    if (!position) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Mevki", `Geçerli mevki kodu: ${positionCode}`)],
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

    const member = await fetchMember(interaction.guild, user.id);
    const displayName = member?.displayName ?? null;
    const baseName =
      customName || displayName || user.displayName || user.username;
    const startGen = DEFAULT_START_GEN;

    const [player] = await db
      .insert(playersTable)
      .values({
        teamId: team.id,
        discordUserId: user.id,
        guildId: interaction.guildId ?? null,
        name: baseName,
        position: position.code,
        gen: startGen,
      })
      .returning();

    let nickResult: { ok: boolean; reason?: string; nickname: string } | null = null;
    if (member) {
      nickResult = await applyNickname(member, baseName, startGen, position.code);
    }

    const lines = [
      `<@${user.id}> → **${player!.name}** (${position.label})`,
      `🏟️ **${team.name}** kadrosuna katıldı.`,
      ``,
      `📊 **Başlangıç GEN:** \`${startGen}\` / ${120}`,
      `📍 **Mevki:** \`${position.code}\` (${position.label})`,
      `🆔 Oyuncu ID: \`${player!.id}\``,
      `👤 Discord ID: \`${user.id}\``,
    ];
    if (nickResult?.ok) {
      lines.push(``, `✏️ Discord takma adı şu şekilde ayarlandı: \`${nickResult.nickname}\``);
    } else if (nickResult && !nickResult.ok) {
      lines.push(
        ``,
        `⚠️ Discord takma adı değiştirilemedi: ${nickResult.reason}\nManüel olarak: \`${nickResult.nickname}\``,
      );
    }

    await interaction.reply({
      embeds: [successEmbed("Oyuncu Eklendi", lines.join("\n"))],
    });
  },
};
