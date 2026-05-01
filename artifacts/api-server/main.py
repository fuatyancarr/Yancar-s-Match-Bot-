import asyncio
import os
import sys
import logging
import time
import discord
from discord.ext import commands
# db modülünün var olduğundan emin ol, yoksa bu satırı sil
try:
    import db as database
except ImportError:
    database = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("turk-ligi")

COGS = ["cogs.public", "cogs.training_gen", "cogs.admin"]
PORT = int(os.environ.get("PORT", 10000))
_bot_ref = None

class TurkLigiBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True 
        intents.members = True
        super().__init__(command_prefix=".", intents=intents)

    async def setup_hook(self):
        for cog in COGS:
            try:
                await self.load_extension(cog)
                log.info(f"Cog yuklendi: {cog}")
            except Exception as e:
                log.error(f"Cog hatasi {cog}: {e}")
        await self.tree.sync()

    async def on_ready(self):
        log.info(f"Bot hazir: {self.user}")

async def _uptime_server():
    from aiohttp import web
    async def index(request):
        return web.Response(text="Bot Calisiyor!", content_type="text/plain")

    async def ping(request):
        ready = _bot_ref is not None and _bot_ref.is_ready()
        return web.json_response({"status": "ok" if ready else "starting"})

    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/api/ping", ping)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    log.info(f"Uptime sunucusu port {PORT} uzerinde aktif.")

async def main():
    global _bot_ref
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("Token bulunamadi!")
        return

    await _uptime_server()
    
    if database:
        try:
            await database.init_db()
        except Exception as e:
            log.error(f"Veritabani hatasi: {e}")

    bot = TurkLigiBot()
    _bot_ref = bot
    async with bot:
        await bot.start(token)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        log.error(f"Ana dongu hatasi: {e}")
