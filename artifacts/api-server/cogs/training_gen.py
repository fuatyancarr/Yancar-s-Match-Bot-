"""Antrenman ve GEN komutları."""
from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
import db
from config import MIN_GEN, MAX_GEN
from utils.embeds import success_embed, error_embed
from utils.permissions import require_gen_authorized
from utils.nickname import sync_player_nickname


class TrainingGenCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ─── /genarttir ──────────────────────────────────────────────────────────
    @app_commands.command(name="genarttir", description="Etiketlenen oyuncunun GEN'ini +1 arttırır (GEN yetkili veya Yönetici)")
    @app_commands.describe(oyuncu="GEN'i arttırılacak Discord kullanıcısı")
    async def genarttir(self, interaction: discord.Interaction, oyuncu: discord.Member):
        if not await require_gen_authorized(interaction):
            return
        player = await db.get_player_by_discord_id(str(oyuncu.id))
        if not player:
            await interaction.response.send_message(
                embed=error_embed("Oyuncu Bulunamadı", f"<@{oyuncu.id}> kayıtlı bir oyuncu değil."),
                ephemeral=True,
            )
            return
        if player["rating"] >= MAX_GEN:
            await interaction.response.send_message(
                embed=error_embed("Maksimum GEN", f"**{player['name']}** zaten {MAX_GEN} GEN'e ulaşmış."),
                ephemeral=True,
            )
            return
        old_gen = player["rating"]
        updated = await db.adjust_player_gen(player["id"], +1)
        await sync_player_nickname(interaction.guild, updated)
        await interaction.response.send_message(
            embed=success_embed(
                "GEN Arttırıldı",
                f"<@{oyuncu.id}> **{updated['name']}** → GEN: `{old_gen}` → `{updated['rating']}` (+1)",
            )
        )

    # ─── /gendusur ───────────────────────────────────────────────────────────
    @app_commands.command(name="gendusur", description="Etiketlenen oyuncunun GEN'ini -1 düşürür (GEN yetkili veya Yönetici)")
    @app_commands.describe(oyuncu="GEN'i düşürülecek Discord kullanıcısı")
    async def gendusur(self, interaction: discord.Interaction, oyuncu: discord.Member):
        if not await require_gen_authorized(interaction):
            return
        player = await db.get_player_by_discord_id(str(oyuncu.id))
        if not player:
            await interaction.response.send_message(
                embed=error_embed("Oyuncu Bulunamadı", f"<@{oyuncu.id}> kayıtlı bir oyuncu değil."),
                ephemeral=True,
            )
            return
        if player["rating"] <= MIN_GEN:
            await interaction.response.send_message(
                embed=error_embed("Minimum GEN", f"**{player['name']}** zaten {MIN_GEN} GEN'de."),
                ephemeral=True,
            )
            return
        old_gen = player["rating"]
        updated = await db.adjust_player_gen(player["id"], -1)
        await sync_player_nickname(interaction.guild, updated)
        await interaction.response.send_message(
            embed=success_embed(
                "GEN Düşürüldü",
                f"<@{oyuncu.id}> **{updated['name']}** → GEN: `{old_gen}` → `{updated['rating']}` (-1)",
            )
        )

    # ─── /genayarla ──────────────────────────────────────────────────────────
    @app_commands.command(name="genayarla", description=f"Bir oyuncunun GEN'ini doğrudan ayarlar ({MIN_GEN}-{MAX_GEN})")
    @app_commands.describe(
        oyuncu="GEN'i ayarlanacak Discord kullanıcısı",
        yeni_gen=f"Yeni GEN değeri ({MIN_GEN}-{MAX_GEN})",
    )
    async def genayarla(
        self,
        interaction: discord.Interaction,
        oyuncu: discord.Member,
        yeni_gen: app_commands.Range[int, MIN_GEN, MAX_GEN],
    ):
        if not await require_gen_authorized(interaction):
            return
        player = await db.get_player_by_discord_id(str(oyuncu.id))
        if not player:
            await interaction.response.send_message(
                embed=error_embed("Oyuncu Bulunamadı", f"<@{oyuncu.id}> kayıtlı bir oyuncu değil."),
                ephemeral=True,
            )
            return
        old_gen = player["rating"]
        updated = await db.set_player_gen(player["id"], yeni_gen)
        await sync_player_nickname(interaction.guild, updated)
        await interaction.response.send_message(
            embed=success_embed(
                "GEN Ayarlandı",
                f"<@{oyuncu.id}> **{updated['name']}** → GEN: `{old_gen}` → `{updated['rating']}`",
            )
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(TrainingGenCog(bot))
