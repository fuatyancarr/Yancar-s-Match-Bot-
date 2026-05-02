import { SlashCommandBuilder } from "discord.js";
import { primaryEmbed } from "../util/embeds";
import {
  DEFAULT_START_GEN,
  MAX_GEN,
  TRAININGS_PER_GEN,
  SEASON_END_GEN_DECAY,
  TRAINING_COOLDOWN_MS,
} from "../services/gen";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("yardim")
    .setDescription("Botun nasıl çalıştığını ve komutları gösterir"),
  async execute(interaction) {
    const cooldownHours = Math.round(TRAINING_COOLDOWN_MS / 3_600_000);
    const embed = primaryEmbed("⚽ Türk Ligi Botu — Komutlar")
      .setDescription(
        "Maçlar **Baz Reyting + Ev Avantajı (+3) + Taktik Boostu = GPR** formülüyle simüle edilir.\n" +
          `Oyuncular **${DEFAULT_START_GEN} GEN** ile başlar, antrenman ile yükselir (max **${MAX_GEN}**), her sezon sonunda **-${SEASON_END_GEN_DECAY} GEN** kaybeder.`,
      )
      .addFields(
        {
          name: "📊 Lig & Bilgi",
          value:
            "`/takim-listesi` Tüm takımlar\n" +
            "`/takim-bilgi <takım>` Takım detayı\n" +
            "`/kadro <takım>` Takım kadrosu + maç kadrosu\n" +
            "`/puan-tablosu` Lig puan durumu\n" +
            "`/gol-krallari` Gol krallığı\n" +
            "`/son-maclar` Son 10 maç",
        },
        {
          name: "💪 Antrenman & GEN",
          value:
            `\`/antrenman\` Antrenman yap (${cooldownHours} saatlik cooldown, +1 ile +4 puan, ${TRAININGS_PER_GEN} antrenman = +1 GEN)\n` +
            "`/genarttir <oyuncu>` GEN +1 (yetkili)\n" +
            "`/gendusur <oyuncu>` GEN -1 (yetkili)\n" +
            "`/genayarla <oyuncu> <gen>` GEN ayarla (yetkili)",
        },
        {
          name: "📋 Taktik & Kadro",
          value:
            "`/taktik-belirle <takım> <diziliş>` Takım dizilişi (yönetici)\n" +
            "`/taktik-bilgi <takım>` Aktif taktik\n" +
            "`/kadro-ekle <takım> <görsel>` 11'i AI ile görselden çıkar (yönetici)",
        },
        {
          name: "👮 Yönetici Komutları",
          value:
            "`/takim-ekle` Yeni takım (Discord rolü zorunlu)\n" +
            "`/oyuncu-ekle` Yeni oyuncu (mevki zorunlu)\n" +
            "`/mac-yap <ev> <deplasman>` Maç simüle et (kadrolar zorunlu)\n" +
            "`/transfer <oyuncu> <takım>` Oyuncu transferi\n" +
            "`/reyting-guncelle <takım> <reyting>` Baz reyting\n" +
            "`/yetkili-rol ekle/cikar/listele` GEN yetkili rolleri\n" +
            `\`/sezon-baslat <onay>\` Yeni sezon (-${SEASON_END_GEN_DECAY} GEN herkese)`,
        },
        {
          name: "🧮 GPR Formülü",
          value:
            "**GPR** = Baz Reyting + Ev Avantajı (+3 / 0) + Taktik Boostu (+1 → +6)\n\n" +
            "**Örnek:**\n" +
            "Kocaelispor (Ev): 65 + 3 + 4 = **72 GPR**\n" +
            "Fenerbahçe (Dep): 80 + 0 + 2 = **82 GPR**",
        },
        {
          name: "🏷️ Discord Takma Adı",
          value: "Format: `İsim | GEN | MEVKİ` (örn. `Ahmet | 67 | ST`). Otomatik güncellenir.",
        },
      )
      .setFooter({ text: "Türk Ligi Bot • Powered by Gemini AI" });
    await interaction.reply({ embeds: [embed] });
  },
};
