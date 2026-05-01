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

PORT = int(os.environ.get("PORT", 10000))
START_TIME = time.time()
_bot_ref: "TurkLigiBot | None" = None

def _format_uptime(seconds: float) -> str:
    td = datetime.timedelta(seconds=int(seconds))
    days = td.days
    hours, remainder = divmod(td.seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    parts = []
    if days: parts.append(f"{days}g")
    if hours: parts.append(f"{hours}s")
    if minutes: parts.append(f"{minutes}d")
    parts.append(f"{secs}sn")
    return " ".join(parts)

class TurkLigiBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.guilds = True
        intents.message_content = True 
        intents.members = True
        super().__init__(command_prefix=".", intents=intents)

    async def setup_hook(self):
        for cog in COGS:
            try:
                await self.load_extension(cog)
                log.info(f"Cog yüklendi: {cog}")
            except Exception as e:
                log.error(f"Cog yüklenemedi {cog}: {e}")
        synced = await self.tree.sync()
        log.info(f"Senkronize edilen komut sayısı: {len(synced)}")

    async def on_ready(self):
        log.info(f"Bot hazır: {self.user} (ID: {self.user.id})")
        await self.change_presence(activity=discord.Activity(type=discord.ActivityType.watching, name="Türk Ligi ⚽"))

async def _uptime_server():
    from aiohttp import web
    async def index(request):
        bot = _bot_ref
        ready = bot is not None and bot.is_ready()
        uptime_str = _format_uptime(time.time() - START_TIME)
        # HATA BURADAYDI: Bot hazır değilse değerleri güvenli alıyoruz
        bot_name = str(bot.user) if ready else "Türk Ligi Bot"
        latency = f"{bot.latency * 1000:.1f}ms" if ready else "—"
        guilds = len(bot.guilds) if ready else 0
        
        html = f"<html><body style='background:#0d1117;color:white;text-align:center;padding:50px;font-family:sans-serif;'>"
        html += f"<h1>{bot_name}</h1><p>Durum: {'Aktif' if ready else 'Baslatiliyor...'}</p>"
        html += f"<p>Uptime: {uptime_str} | Sunucu: {guilds} | Ping: {latency}</p></body></html>"
        return web.Response(text=html, content_type="text/html")

    async def ping(request):
        bot = _bot_ref
        ready = bot is not None and bot.is_ready()
        return web.json_response({
            "status": "ok" if ready else "starting",
            "ready": ready,
            "latency": round(bot.latency * 1000, 1) if ready else None
        })

    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/api/ping", ping)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    log.info(f"Uptime sunucusu port {PORT} üzerinde baslatildi.")

async def main():
    global _bot_ref
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("Token bulunamadi!")
        return

    await _uptime_server()
    await database.init_db()
    
    bot = TurkLigiBot()
    _bot_ref = bot
    async with bot:
        await bot.start(token)

if __name__ == "__main__":
    asyncio.run(main())
