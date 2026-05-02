import { SlashCommandBuilder } from "discord.js";
import { findTeamByName, searchTeams } from "../services/teams";
import { simulateMatch } from "../services/match";
import { requireAdmin } from "../util/permissions";
import { errorEmbed, primaryEmbed, teamColor } from "../util/embeds";
import { logger } from "../../lib/logger";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("mac-yap")
    .setDescription("İki takım arasında maç simülasyonu (Sadece Yönetici, kadrolar zorunlu)")
    .addStringOption((o) =>
      o
        .setName("ev")
        .setDescription("Ev sahibi takım")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName("deplasman")
        .setDescription("Deplasman takımı")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "ev" && focused.name !== "deplasman") return;
    const teams = await searchTeams(String(focused.value), 25);
    await interaction.respond(
      teams.map((t) => ({ name: `${t.name} (${t.shortName})`, value: t.name })),
    );
  },
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const homeQ = interaction.options.getString("ev", true);
    const awayQ = interaction.options.getString("deplasman", true);

    const [home, away] = await Promise.all([
      findTeamByName(homeQ),
      findTeamByName(awayQ),
    ]);
    if (!home) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `Ev sahibi: \`${homeQ}\``)],
        ephemeral: true,
      });
      return;
    }
    if (!away) {
      await interaction.reply({
        embeds: [errorEmbed("Takım Bulunamadı", `Deplasman: \`${awayQ}\``)],
        ephemeral: true,
      });
      return;
    }
    if (home.id === away.id) {
      await interaction.reply({
        embeds: [errorEmbed("Geçersiz Eşleşme", "Bir takım kendisiyle maç yapamaz.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let result;
    try {
      result = await simulateMatch(home.id, away.id);
    } catch (err) {
      logger.error({ err }, "Maç simülasyonu başarısız");
      await interaction.editReply({
        embeds: [errorEmbed("Maç Yapılamadı", (err as Error).message)],
      });
      return;
    }

    const gprEmbed = primaryEmbed(
      `📋 Maç Hazırlığı: ${home.shortName} vs ${away.shortName}`,
    )
      .setColor(teamColor(home.color))
      .addFields(
        {
          name: `🏠 ${home.name}`,
          value:
            `Baz: **${home.baseRating}** + Ev: **+3** + Taktik: **+${result.homeTacticScore}**\n` +
            `→ **GPR: ${result.homeGpr}** (${result.homeTactic.formationLabel})`,
          inline: false,
        },
        {
          name: `✈️ ${away.name}`,
          value:
            `Baz: **${away.baseRating}** + Ev: **+0** + Taktik: **+${result.awayTacticScore}**\n` +
            `→ **GPR: ${result.awayGpr}** (${result.awayTactic.formationLabel})`,
          inline: false,
        },
      );

    const eventLines: string[] = [];
    let firstHalfShown = false;
    for (const ev of result.events) {
      if (!firstHalfShown && ev.minute > 45) {
        eventLines.push("**⏸️ Devre Arası**");
        firstHalfShown = true;
      }
      let icon = "•";
      if (ev.type === "GOL") icon = ev.team === "ev" ? "🏠⚽" : "✈️⚽";
      else if (ev.type === "SARI_KART") icon = "🟨";
      else if (ev.type === "KIRMIZI_KART") icon = "🟥";
      eventLines.push(`\`${ev.minute}'\` ${icon} ${ev.description}`);
    }
    if (!firstHalfShown) eventLines.push("**⏸️ Devre Arası**");
    if (eventLines.length === 1) eventLines.push("_Bu yarıda kayda değer olay yaşanmadı._");
    eventLines.push("**🔚 Maç Sonu**");

    const eventsText = eventLines.join("\n").slice(0, 4000);

    const winColor =
      result.homeScore > result.awayScore
        ? teamColor(home.color)
        : result.awayScore > result.homeScore
          ? teamColor(away.color)
          : 0xf1c40f;

    const finalEmbed = primaryEmbed(
      `🏆 ${home.shortName} ${result.homeScore} — ${result.awayScore} ${away.shortName}`,
    )
      .setColor(winColor)
      .setDescription(result.narrative)
      .addFields(
        {
          name: "📊 Maç İstatistikleri",
          value:
            `Topla Oynama: **%${result.homePossession}** - **%${100 - result.homePossession}**\n` +
            `Şut: **${result.homeShots}** - **${result.awayShots}**\n` +
            `İsabetli Şut: **${result.homeShotsOnTarget}** - **${result.awayShotsOnTarget}**`,
          inline: false,
        },
        {
          name: "📜 Maç Olayları",
          value: eventsText,
          inline: false,
        },
      )
      .setFooter({
        text: `Maç ID: ${result.matchId} • GPR ${result.homeGpr} - ${result.awayGpr}`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [gprEmbed, finalEmbed] });
  },
};
