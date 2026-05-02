import {
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { db, genAuthorizedRolesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

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

export async function isGenAuthorized(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.inGuild()) return false;
  if (isAdmin(interaction)) return true;
  const guildId = interaction.guildId;
  if (!guildId) return false;
  const member = interaction.member;
  if (!member) return false;
  const memberRoles = (member as GuildMember).roles;
  if (!memberRoles || !("cache" in memberRoles)) return false;
  const roleIds = Array.from(memberRoles.cache.keys());
  if (roleIds.length === 0) return false;
  const rows = await db
    .select()
    .from(genAuthorizedRolesTable)
    .where(eq(genAuthorizedRolesTable.guildId, guildId));
  const allowed = new Set(rows.map((r) => r.roleId));
  return roleIds.some((rid) => allowed.has(rid));
}

export async function requireGenAuthorized(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (await isGenAuthorized(interaction)) return true;
  await interaction.reply({
    content:
      "🚫 Bu komutu kullanma yetkin yok. Sadece **GEN yetkili rolüne** veya **yönetici yetkisine** sahip kişiler GEN değişikliği yapabilir.",
    ephemeral: true,
  });
  return false;
}

export async function listAuthorizedRoles(guildId: string) {
  return db
    .select()
    .from(genAuthorizedRolesTable)
    .where(eq(genAuthorizedRolesTable.guildId, guildId));
}

export async function addAuthorizedRole(guildId: string, roleId: string) {
  await db
    .insert(genAuthorizedRolesTable)
    .values({ guildId, roleId })
    .onConflictDoNothing();
}

export async function removeAuthorizedRole(guildId: string, roleId: string) {
  await db
    .delete(genAuthorizedRolesTable)
    .where(
      and(
        eq(genAuthorizedRolesTable.guildId, guildId),
        eq(genAuthorizedRolesTable.roleId, roleId),
      ),
    );
}
