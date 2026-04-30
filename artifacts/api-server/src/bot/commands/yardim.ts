import { SlashCommandBuilder } from "discord.js";
import { primaryEmbed } from "../util/embeds";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("yardim")
    .setDescription("Botun nasıl çalıştığını ve komutları gösterir"),
  async execute(interaction) {
    const embed = primaryEmbed("🛡️ Türk Ligi Botu — Komutlar")
      .setDescription(
        "Maçlar **Baz Reyting + Ev Avantajı + AI Taktik Boostu = GPR** formülüyle simüle edilir. AI taktiğinizi 0-6 arası puanlar ve maç anlatımı oluşturur.",
      )
      .addFields(
        {
          name: "📊 Lig & Bilgi",
          value:
            "`/takim-listesi` Tüm takımlar\n" +
            "`/takim-bilgi <takım>` Takım detayı\n" +
            "`/kadro <takım>` Takımın kadrosu\n" +
            "`/puan-tablosu` Lig puan durumu\n" +
            "`/gol-krallari` Gol krallığı\n" +
            "`/son-maclar` Son 10 maç",
        },
        {
          name: "📋 Taktik",
          value:
            "`/taktik-yukle <takım> <dosya>` .txt taktik dosyası yükle\n" +
            "`/taktik-bilgi <takım>` Aktif taktik analizi",
        },
        {
          name: "👮 Yönetici Komutları",
          value:
            "`/takim-ekle` Yeni takım\n" +
            "`/oyuncu-ekle` Yeni oyuncu\n" +
            "`/mac-yap <ev> <deplasman>` Maç simüle et\n" +
            "`/transfer <oyuncu-id> <takım>` Oyuncu transferi\n" +
            "`/reyting-guncelle <takım> <reyting>` Baz reyting güncelle\n" +
            "`/sezon-baslat <onay>` Yeni sezon (istatistikler sıfırlanır)",
        },
        {
          name: "🧮 GPR Formülü",
          value:
            "**GPR** = Baz Reyting + Ev Avantajı (+3 / 0) + AI Taktik Boostu (+0 → +6)\n\n" +
            "**Örnek:**\n" +
            "Kocaelispor (Ev): 65 + 3 + 4 = **72 GPR**\n" +
            "Fenerbahçe (Dep): 80 + 0 + 2 = **82 GPR**",
        },
      )
      .setFooter({ text: "Türk Ligi Bot • Powered by Gemini AI" });
    await interaction.reply({ embeds: [embed] });
  },
};
