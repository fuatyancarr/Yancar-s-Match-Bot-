import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, searchTeams, teamSquad } from "../services/teams";
import { requireAdmin } from "../util/permissions";
import { errorEmbed, successEmbed, primaryEmbed, teamColor } from "../util/embeds";
import {
  extractLineupFromImage,
  matchPlayersToSquad,
  saveLineup,
} from "../services/lineup";
import { findFormation, getFormationOrDefault } from "../util/formations";
import { logger } from "../../lib/logger";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("kadro-ekle")
    .setDescription("Takım maç kadrosunu görselden AI ile çıkarır (Sadece Yönetici)")
    .addStringOption((o) =>
      o
        .setName("takim")
        .setDescription("Kadrosu ayarlanacak takım")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addAttachmentOption((o) =>
      o
        .setName("gorsel")
        .setDescription("11 kişilik kadro görseli (diziliş diyagramı, isim listesi vb.)")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("dizilis")
        .setDescription("Opsiyonel: AI yanlış tespit ederse manuel diziliş kodu (örn: 4-3-3)")
        .setRequired(false),
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "takim") return;
    const teams = await searchTeams(String(focused.value), 25);
    await interaction.respond(
      teams.map((t) => ({ name: `${t.name} (${t.shortName})`, value: t.name })),
    );
  },
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const teamQ = interaction.options.getString("takim", true);
    const attachment = interaction.options.getAttachment("gorsel", true);
    const overrideFormation = interaction.options.getString("dizilis", false);

    const team = await findTeamByName(teamQ);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${teamQ}\``)],
        ephemeral: true,
      });
      return;
    }

    if (!attachment.contentType?.startsWith("image/")) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Geçersiz Dosya",
            `Yüklenen dosya bir görsel değil. Görsel formatı (PNG, JPG, WebP) yükleyin.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const squad = await teamSquad(team.id);
    if (squad.length < 11) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Yetersiz Kadro",
            `**${team.name}** kadrosunda yalnızca **${squad.length}** oyuncu var. En az 11 oyuncu gerekli.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let extraction;
    try {
      extraction = await extractLineupFromImage(
        attachment.url,
        attachment.contentType ?? null,
      );
    } catch (err) {
      logger.error({ err }, "Görsel analizi başarısız");
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "AI Analiz Hatası",
            `Görsel analiz edilemedi: ${(err as Error).message}`,
          ),
        ],
      });
      return;
    }

    if (extraction.playerNames.length === 0) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Oyuncu Bulunamadı",
            "Görselde oyuncu adı tespit edilemedi. Daha net bir görsel yükleyin veya elle kadro belirleyin.",
          ),
        ],
      });
      return;
    }

    const matchResult = matchPlayersToSquad(extraction.playerNames, squad);
    if (matchResult.matched.length < 11) {
      const lines = [
        `Görselden **${extraction.playerNames.length}** oyuncu adı çıkarıldı, ancak takım kadrosunda yalnızca **${matchResult.matched.length}** tanesi eşleşti.`,
        ``,
        `**Eşleşen:**`,
        ...matchResult.matched.map(
          (m) => `✅ \`${m.extractedName}\` → **${m.player.name}** (%${m.score})`,
        ),
      ];
      if (matchResult.unmatched.length > 0) {
        lines.push(``, `**Eşleşmeyen:**`);
        lines.push(...matchResult.unmatched.map((n) => `❌ \`${n}\``));
      }
      lines.push(
        ``,
        `Lütfen oyuncu adlarını kadrodakilerle uyumlu olacak şekilde düzeltin veya tekrar deneyin.`,
      );
      await interaction.editReply({
        embeds: [
          errorEmbed("Kadro Eşleşmesi Yetersiz", lines.join("\n").slice(0, 4000)),
        ],
      });
      return;
    }

    const finalEleven = matchResult.matched.slice(0, 11).map((m) => m.player);
    const formationCode =
      (overrideFormation && findFormation(overrideFormation)?.code) ||
      (extraction.formation && findFormation(extraction.formation)?.code) ||
      team.formation ||
      "4-4-2";
    const formation = getFormationOrDefault(formationCode);

    await saveLineup(
      team.id,
      finalEleven.map((p) => p.id),
      formation.code,
    );

    const lineupLines = finalEleven.map(
      (p, i) => `${i + 1}. \`${p.position}\` **${p.name}** — GEN ${p.gen}`,
    );
    const embed = primaryEmbed(`📋 ${team.name} — Maç Kadrosu Hazır`)
      .setColor(teamColor(team.color))
      .setDescription(
        `🤖 AI görseli analiz etti ve **${matchResult.matched.length}** oyuncu eşleştirdi.\n\n` +
          (extraction.rawAnalysis ? `_${extraction.rawAnalysis}_\n\n` : "") +
          `📐 **Diziliş:** ${formation.label} (${formation.code})\n` +
          `⚡ **Taktik Boostu:** +${formation.tacticBoost}\n\n` +
          `**11 Kişilik Kadro:**\n${lineupLines.join("\n")}`,
      )
      .setFooter({ text: "Maç başlamak için /mac-yap kullanılabilir" });

    await interaction.editReply({
      embeds: [successEmbed("Kadro Kaydedildi"), embed],
    });
  },
};
