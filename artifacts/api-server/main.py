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

PORT = int(os.environ.get("PORT", "8080"))

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


async def _uptime_server():
    """Uptime izleme ve health check için HTTP sunucusu."""
    from aiohttp import web

    async def index(request):
        uptime_secs = time.time() - START_TIME
        uptime_str = _format_uptime(uptime_secs)
        bot = _bot_ref
        bot_status = "Çevrimiçi" if (bot and bot.is_ready()) else "Başlatılıyor..."
        latency = f"{bot.latency * 1000:.1f}ms" if (bot and bot.is_ready()) else "—"
        guilds = len(bot.guilds) if (bot and bot.is_ready()) else 0
        bot_name = str(bot.user) if (bot and bot.is_ready()) else "Türk Ligi Bot"
        status_color = "#2ecc71" if (bot and bot.is_ready()) else "#e67e22"
        status_dot = "#2ecc71" if (bot and bot.is_ready()) else "#e67e22"

        html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Türk Ligi Bot — Durum</title>
<meta http-equiv="refresh" content="30">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }}
  .card {{
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 16px;
    padding: 40px;
    max-width: 480px;
    width: 100%;
    text-align: center;
  }}
  .bot-icon {{
    width: 72px;
    height: 72px;
    background: #5865f2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 36px;
  }}
  h1 {{ font-size: 22px; font-weight: 700; margin-bottom: 6px; }}
  .status-badge {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #1c2128;
    border: 1px solid #30363d;
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 14px;
    margin: 16px 0 28px;
    color: {status_color};
    font-weight: 600;
  }}
  .dot {{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: {status_dot};
    animation: pulse 2s infinite;
  }}
  @keyframes pulse {{
    0%, 100% {{ opacity: 1; }}
    50% {{ opacity: 0.4; }}
  }}
  .stats {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 28px;
  }}
  .stat {{
    background: #1c2128;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 14px;
  }}
  .stat-value {{
    font-size: 20px;
    font-weight: 700;
    color: #58a6ff;
    margin-bottom: 4px;
  }}
  .stat-label {{
    font-size: 11px;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .ping-url {{
    background: #1c2128;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 12px;
    color: #8b949e;
    word-break: break-all;
  }}
  .ping-label {{
    font-size: 11px;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }}
  .footer {{
    margin-top: 24px;
    font-size: 11px;
    color: #484f58;
  }}
</style>
</head>
<body>
<div class="card">
  <div class="bot-icon">⚽</div>
  <h1>{bot_name}</h1>
  <p style="color:#8b949e;font-size:13px;">Türk Ligi Discord Botu</p>
  <div class="status-badge">
    <span class="dot"></span>
    {bot_status}
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">{uptime_str}</div>
      <div class="stat-label">Çalışma Süresi</div>
    </div>
    <div class="stat">
      <div class="stat-value">{latency}</div>
      <div class="stat-label">Gecikme</div>
    </div>
    <div class="stat">
      <div class="stat-value">{guilds}</div>
      <div class="stat-label">Sunucu</div>
    </div>
    <div class="stat">
      <div class="stat-value">v2.0</div>
      <div class="stat-label">Sürüm</div>
    </div>
  </div>
  <div class="ping-label">UptimeRobot Ping URL</div>
  <div class="ping-url">/api/ping</div>
  <div class="footer">Sayfa her 30 saniyede otomatik yenilenir</div>
</div>
</body>
</html>"""
        return web.Response(text=html, content_type="text/html")

    async def ping(request):
        bot = _bot_ref
        ready = bot is not None and bot.is_ready()
        uptime_secs = time.time() - START_TIME
        data = {
            "status": "ok" if ready else "starting",
            "bot": "Türk Ligi Bot",
            "uptime_seconds": int(uptime_secs),
            "uptime": _format_uptime(uptime_secs),
            "latency_ms": round(bot.latency * 1000, 1) if ready else None,
            "guilds": len(bot.guilds) if ready else 0,
            "ready": ready,
        }
        import json
        return web.Response(
            text=json.dumps(data, ensure_ascii=False),
            content_type="application/json"
        )

    async def healthz(request):
        import json
        return web.Response(
            text=json.dumps({"status": "ok", "bot": "Türk Ligi Bot"}, ensure_ascii=False),
            content_type="application/json"
        )

    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/api", index)
    app.router.add_get("/api/", index)
    app.router.add_get("/api/ping", ping)
    app.router.add_get("/api/healthz", healthz)
    app.router.add_get("/healthz", healthz)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    log.info(f"Uptime sunucusu başlatıldı: port {PORT}")


async def main():
    global _bot_ref

    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("DISCORD_BOT_TOKEN tanımlı değil. Bot başlatılamadı.")
        sys.exit(1)

    await _uptime_server()
    await database.init_db()
    log.info("Veritabanı tabloları hazır.")

    bot = TurkLigiBot()
    _bot_ref = bot

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
