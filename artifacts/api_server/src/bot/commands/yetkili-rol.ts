import { SlashCommandBuilder } from "discord.js";
import { successEmbed, errorEmbed, primaryEmbed } from "../util/embeds";
import {
  requireAdmin,
  addAuthorizedRole,
  removeAuthorizedRole,
  listAuthorizedRoles,
} from "../util/permissions";
import type { SlashCommand } from "./types";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("yetkili-rol")
    .setDescription("GEN değiştirme yetkisi olan rolleri yönetir (Sadece Yönetici)")
    .addSubcommand((s) =>
      s
        .setName("ekle")
        .setDescription("Bir rolü GEN yetkili rollerine ekler")
        .addRoleOption((o) =>
          o.setName("rol").setDescription("Yetki verilecek rol").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("cikar")
        .setDescription("Bir rolü GEN yetkili rollerinden çıkarır")
        .addRoleOption((o) =>
          o.setName("rol").setDescription("Yetkisi alınacak rol").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("listele").setDescription("Tüm GEN yetkili rolleri listeler"),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    if (!interaction.guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Hata", "Sunucu bulunamadı.")],
        ephemeral: true,
      });
      return;
    }
    const sub = interaction.options.getSubcommand(true);

    if (sub === "ekle") {
      const role = interaction.options.getRole("rol", true);
      await addAuthorizedRole(interaction.guildId, role.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Rol Eklendi",
            `<@&${role.id}> rolü artık GEN değiştirme yetkisine sahip.`,
          ),
        ],
      });
      return;
    }
    if (sub === "cikar") {
      const role = interaction.options.getRole("rol", true);
      await removeAuthorizedRole(interaction.guildId, role.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Rol Çıkarıldı",
            `<@&${role.id}> rolünün GEN yetkisi kaldırıldı.`,
          ),
        ],
      });
      return;
    }
    if (sub === "listele") {
      const rows = await listAuthorizedRoles(interaction.guildId);
      if (rows.length === 0) {
        await interaction.reply({
          embeds: [
            primaryEmbed("GEN Yetkili Roller").setDescription(
              "Henüz GEN yetkili rolü ayarlanmamış. `/yetkili-rol ekle` ile rol ekleyin.\n\n_Yönetici yetkisine sahip kişiler her zaman GEN komutlarını kullanabilir._",
            ),
          ],
        });
        return;
      }
      const lines = rows.map((r) => `• <@&${r.roleId}>`).join("\n");
      await interaction.reply({
        embeds: [
          primaryEmbed(`GEN Yetkili Roller (${rows.length})`).setDescription(
            `${lines}\n\n_Yönetici yetkisine sahip kişiler her zaman GEN komutlarını kullanabilir._`,
          ),
        ],
      });
    }
  },
};
