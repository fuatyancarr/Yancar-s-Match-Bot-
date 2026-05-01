"""Türk Ligi Discord Bot — Python girişi."""
from __future__ import annotations
import asyncio
import os
import sys
import logging
import time
import datetime
import discord
from discord.ext import commands
import db as database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("turk-ligi")

COGS = [
    "cogs.public",
    "cogs.training_gen",
    "cogs.admin",
]

# RENDER İÇİN PORT 10000 OLARAK GÜNCELLENDİ
PORT = int(os.environ.get("PORT", 10000))

START_TIME = time.time()
_bot_ref: "TurkLigiBot | None" = None


def _format_uptime(seconds: float) -> str:
    td = datetime.timedelta(seconds=int(seconds))
    days = td.days
    hours, remainder = divmod(td.seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}g")
    if hours:
        parts.append(f"{hours}s")
    if minutes:
        parts.append(f"{minutes}d")
    parts.append(f"{secs}sn")
    return " ".join(parts)


class TurkLigiBot(commands.Bot):
    def __init__(self):
        # İZİNLER (INTENTS) GÜNCELLENDİ - MESAJLARI OKUMA İZNİ EKLENDİ
        intents = discord.Intents.default()
        intents.guilds = True
        intents.message_content = True 
        intents.members = True
        
        # Buradaki command_prefix'i Discord'da ne kullanıyorsan o yap (nokta ise "." kalsın)
        super().__init__(command_prefix=".", intents=intents)

    async def setup_hook(self):
        for cog in COGS:
            try:
                await self.load_extension(cog)
                log.info(f"Cog yüklendi: {cog}")
            except Exception as e:
                log.error(f"Cog yüklenemedi {cog}: {e}", exc_info=True)
        log.info("Slash komutlar global olarak senkronize ediliyor...")
        synced = await self.tree.sync()
        log.info(f"Senkronize edilen komut sayısı: {len(synced)}")

    async def on_ready(self):
        log.info(f"Bot hazır: {self.user} (ID: {self.user.id})")
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="Türk Ligi ⚽"
            )
        )

    async def on_command_error(self, ctx, error):
        log.error(f"Komut hatası: {error}")


async def _uptime_server():
    """Uptime izleme ve health check için HTTP sunucusu."""
    from aiohttp import web

    async def index(request):
        uptime_secs = time.time() - START_TIME
        uptime_str = _format_uptime(uptime_secs)
        bot = _bot_ref
        bot_status = "Çevrimiçi" if (bot and bot.is_ready()) else "Başlatılıyor..."
        latency = f"{bot.latency * 1000:.1f}ms" if (bot and bot.is_ready()) else "—"
        guilds = len(bot.guild
        