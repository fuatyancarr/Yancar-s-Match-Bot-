"""İzin yardımcıları."""
import discord
from discord import app_commands
import db


def is_admin(interaction: discord.Interaction) -> bool:
    if not interaction.guild:
        return False
    member = interaction.user
    if not isinstance(member, discord.Member):
        return False
    return (
        member.guild_permissions.administrator
        or member.guild_permissions.manage_guild
    )


async def require_admin(interaction: discord.Interaction) -> bool:
    if not is_admin(interaction):
        await interaction.response.send_message(
            "🚫 Bu komutu kullanma yetkin yok. Sadece sunucu yöneticileri kullanabilir.",
            ephemeral=True,
        )
        return False
    return True


async def is_gen_authorized(interaction: discord.Interaction) -> bool:
    if not interaction.guild:
        return False
    if is_admin(interaction):
        return True
    member = interaction.user
    if not isinstance(member, discord.Member):
        return False
    guild_id = str(interaction.guild_id)
    rows = await db.list_authorized_roles(guild_id)
    allowed = {r["role_id"] for r in rows}
    member_role_ids = {str(r.id) for r in member.roles}
    return bool(allowed & member_role_ids)


async def require_gen_authorized(interaction: discord.Interaction) -> bool:
    if await is_gen_authorized(interaction):
        return True
    await interaction.response.send_message(
        "🚫 Bu komutu kullanma yetkin yok. **GEN yetkili rolüne** veya **yönetici yetkisine** sahip olman gerekiyor.",
        ephemeral=True,
    )
    return False
