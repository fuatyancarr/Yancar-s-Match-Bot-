"""Türk Ligi Discord Bot — Python girişi."""
from __future__ import annotations
import asyncio
import os
import sys
import logging
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

PORT = int(os.environ.get("PORT", "8080"))


class TurkLigiBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.guilds = True
        super().__init__(command_prefix="!", intents=intents)

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


async def _health_server():
    """Replit'in port kontrolü için minimal HTTP sunucusu."""
    from aiohttp import web

    async def healthz(request):
        return web.Response(text='{"status":"ok","bot":"Türk Ligi Bot"}', content_type="application/json")

    app = web.Application()
    app.router.add_get("/api/healthz", healthz)
    app.router.add_get("/healthz", healthz)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    log.info(f"Health check sunucusu başlatıldı: port {PORT}")


async def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("DISCORD_BOT_TOKEN tanımlı değil. Bot başlatılamadı.")
        sys.exit(1)

    await _health_server()

    bot = TurkLigiBot()

    try:
        async with bot:
            await bot.start(token)
    except discord.LoginFailure:
        log.error("Geçersiz Discord token. DISCORD_BOT_TOKEN değerini kontrol et.")
        sys.exit(1)
    except Exception as e:
        log.error(f"Bot başlatma hatası: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await database.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
