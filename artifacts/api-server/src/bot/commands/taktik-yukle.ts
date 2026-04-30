import { SlashCommandBuilder } from "discord.js";
import { findTeamByName } from "../services/teams";
import { analyzeTactic, saveTactic } from "../services/tactics";
import { errorEmbed, primaryEmbed, successEmbed, teamColor } from "../util/embeds";
import { logger } from "../../lib/logger";
import type { SlashCommand } from "./types";

const MAX_FILE_SIZE = 200_000;

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("taktik-yukle")
    .setDescription("Bir takım için taktik dosyası (.txt) yükler")
    .addStringOption((o) =>
      o.setName("takim").setDescription("Hangi takım için").setRequired(true),
    )
    .addAttachmentOption((o) =>
      o.setName("dosya").setDescription(".txt taktik dosyası").setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString("takim", true);
    const file = interaction.options.getAttachment("dosya", true);

    const team = await findTeamByName(query);
    if (!team) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `\`${query}\` adında bir takım yok.`)],
        ephemeral: true,
      });
      return;
    }

    const isText =
      file.contentType?.startsWith("text/") ||
      file.name.toLowerCase().endsWith(".txt");
    if (!isText) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Geçersiz Dosya",
            "Sadece `.txt` formatında metin dosyası yüklenebilir.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Dosya Çok Büyük",
            `Dosya boyutu en fazla ${MAX_FILE_SIZE / 1000} KB olabilir.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let content: string;
    try {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      content = await res.text();
    } catch (err) {
      logger.error({ err }, "Taktik dosyası indirilemedi");
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Dosya İndirilemedi",
            "Taktik dosyası Discord'dan indirilirken bir sorun oluştu.",
          ),
        ],
      });
      return;
    }

    const analysis = await analyzeTactic(content, file.name, team.name);
    await saveTactic(team.id, file.name, content, analysis);

    const embed = successEmbed("Taktik Analiz Edildi ve Kaydedildi")
      .setColor(teamColor(team.color))
      .setDescription(
        `**${team.name}** için yeni taktik aktif edildi.\n\n` +
          `📁 **Dosya:** \`${file.name}\`\n` +
          `📐 **Diziliş:** ${analysis.formation}\n` +
          `🧠 **AI Boost Puanı:** **+${analysis.tacticScore}** / 6`,
      )
      .addFields({
        name: "🤖 AI Analizi",
        value: analysis.analysis.slice(0, 1024),
      });
    await interaction.editReply({ embeds: [embed] });
  },
};
