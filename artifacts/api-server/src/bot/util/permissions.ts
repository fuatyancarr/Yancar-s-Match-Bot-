import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from "discord.js";

export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.inGuild()) return false;
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return (
    perms.has(PermissionsBitField.Flags.Administrator) ||
    perms.has(PermissionsBitField.Flags.ManageGuild)
  );
}

export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content:
        "🚫 Bu komutu kullanma yetkin yok. Sadece sunucu yöneticileri kullanabilir.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}
