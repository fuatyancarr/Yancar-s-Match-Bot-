"""Türk Ligi Discord Bot — Firebase & Uptime Sürümü"""
from __future__ import annotations
import asyncio
import datetime
import json
import logging
import os
import sys
import time

import discord
from discord import app_commands
from discord.ext import commands
import firebase_admin
from firebase_admin import credentials, firestore

from artifacts.api_server import db as database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("turk-ligi")

# ─── Firebase Başlatma ────────────────────────────────────────────────────────
firebase_db = None
try:
    _fb_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if _fb_json:
        _fb_dict = json.loads(_fb_json)
        # Türkçe girilmiş anahtarları İngilizceye çevir
        _key_map = {
            "tür": "type",
            "proje_kimliği": "project_id",
            "hizmet_hesabı": "service_account",
            "özel_anahtar_kimliği": "private_key_id",
            "özel_anahtar": "private_key",
            "istemci_e_postası": "client_email",
            "istemci_kimliği": "client_id",
            "kimlik_doğrulama_uri": "auth_uri",
            "belirteç_uri": "token_uri",
        }
        normalized: dict = {}
        for k, v in _fb_dict.items():
            eng_key = _key_map.get(k, k)
            normalized[eng_key] = v
        # "type" değeri Türkçe geldiyse düzelt
        if normalized.get("type") == "hizmet_hesabı":
            normalized["type"] = "service_account"
        # Orijinal JSON'daki alan adları zaten İngilizce olabilir, birleştir
        _fb_dict.update(normalized)
        _fb_dict["type"] = "service_account"
        cred = credentials.Certificate(_fb_dict)
        firebase_admin.initialize_app(cred)
        firebase_db = firestore.client()
        log.info("Firebase bağlantısı başarılı!")
    else:
        log.warning("FIREBASE_SERVICE_ACCOUNT tanımlı değil, Firebase devre dışı.")
except Exception as e:
    log.error(f"Firebase bağlanırken hata: {e}", exc_info=True)

# ─── Sabitler ─────────────────────────────────────────────────────────────────
COGS = ["cogs.public", "cogs.training_gen", "cogs.admin"]
PORT = int(os.environ.get("PORT", 8080))
START_TIME = time.time()
_bot_ref: "TurkLigiBot | None" = None


def _fmt_uptime(seconds: float) -> str:
    td = datetime.timedelta(seconds=int(seconds))
    days = td.days
    hours, rem = divmod(td.seconds, 3600)
    mins, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}g")
    if hours:
        parts.append(f"{hours}s")
    if mins:
        parts.append(f"{mins}dk")
    parts.append(f"{secs}sn")
    return " ".join(parts)


# ─── Bot ──────────────────────────────────────────────────────────────────────
class TurkLigiBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        for cog in COGS:
            try:
                await self.load_extension(cog)
                log.info(f"Modül yüklendi: {cog}")
            except Exception as e:
                log.error(f"Modül hatası {cog}: {e}", exc_info=True)
        log.info("Slash komutlar senkronize ediliyor...")
        synced = await self.tree.sync()
        log.info(f"Senkronize edilen komut sayısı: {len(synced)}")

    async def on_ready(self):
        log.info(f"Bot aktif: {self.user} (ID: {self.user.id})")
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="Türk Ligi ⚽"
            )
        )

    async def on_app_command_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        log.error(f"Slash komut hatası [{interaction.command and interaction.command.name}]: {error}", exc_info=True)
        cause = getattr(error, "original", error)
        detail = str(cause).strip() or "Bilinmeyen bir hata oluştu."
        msg = f"❌ {detail}"
        try:
            if interaction.response.is_done():
                await interaction.followup.send(msg, ephemeral=True)
            else:
                await interaction.response.send_message(msg, ephemeral=True)
        except Exception:
            pass


# ─── Uptime Sunucusu ──────────────────────────────────────────────────────────
async def _uptime_server():
    from aiohttp import web

    async def index(request):
        bot = _bot_ref
        ready = bot is not None and bot.is_ready()
        uptime = _fmt_uptime(time.time() - START_TIME)
        latency = f"{bot.latency * 1000:.1f}ms" if ready else "—"
        guilds = len(bot.guilds) if ready else 0
        bot_name = str(bot.user) if ready else "Türk Ligi Bot"
        color = "#2ecc71" if ready else "#e67e22"
        status_txt = "Çevrimiçi" if ready else "Başlatılıyor..."
        fb_status = "Bağlı" if firebase_db else "Devre Dışı"
        fb_color = "#2ecc71" if firebase_db else "#e74c3c"

        html = f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Türk Ligi Bot — Durum</title>
<meta http-equiv="refresh" content="30">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}}
.card{{background:#161b22;border:1px solid #30363d;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}}
.icon{{width:72px;height:72px;background:#5865f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px}}
h1{{font-size:22px;font-weight:700;margin-bottom:6px}}
.badge{{display:inline-flex;align-items:center;gap:8px;background:#1c2128;border:1px solid #30363d;border-radius:20px;padding:6px 16px;font-size:14px;margin:16px 0 28px;color:{color};font-weight:600}}
.dot{{width:8px;height:8px;border-radius:50%;background:{color};animation:pulse 2s infinite}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.4}}}}
.stats{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px}}
.stat{{background:#1c2128;border:1px solid #30363d;border-radius:10px;padding:14px}}
.val{{font-size:20px;font-weight:700;color:#58a6ff;margin-bottom:4px}}
.lbl{{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px}}
.ping{{background:#1c2128;border:1px solid #30363d;border-radius:8px;padding:12px 16px;font-size:12px;color:#8b949e;word-break:break-all}}
.ping-lbl{{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}}
.footer{{margin-top:24px;font-size:11px;color:#484f58}}
</style></head>
<body><div class="card">
<div class="icon">⚽</div>
<h1>{bot_name}</h1>
<p style="color:#8b949e;font-size:13px">Türk Ligi Discord Botu</p>
<div class="badge"><span class="dot"></span>{status_txt}</div>
<div class="stats">
<div class="stat"><div class="val">{uptime}</div><div class="lbl">Çalışma Süresi</div></div>
<div class="stat"><div class="val">{latency}</div><div class="lbl">Gecikme</div></div>
<div class="stat"><div class="val">{guilds}</div><div class="lbl">Sunucu</div></div>
<div class="stat"><div class="val" style="color:{fb_color}">{fb_status}</div><div class="lbl">Firebase</div></div>
</div>
<div class="ping-lbl">UptimeRobot Ping URL</div>
<div class="ping">/api/ping</div>
<div class="footer">Sayfa her 30 saniyede otomatik yenilenir</div>
</div></body></html>"""
        return web.Response(text=html, content_type="text/html")

    async def ping(request):
        bot = _bot_ref
        ready = bot is not None and bot.is_ready()
        uptime_secs = time.time() - START_TIME
        data = {
            "status": "ok" if ready else "starting",
            "bot": "Türk Ligi Bot",
            "uptime_seconds": int(uptime_secs),
            "uptime": _fmt_uptime(uptime_secs),
            "latency_ms": round(bot.latency * 1000, 1) if ready else None,
            "guilds": len(bot.guilds) if ready else 0,
            "ready": ready,
            "firebase": firebase_db is not None,
        }
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type="application/json")

    async def healthz(request):
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


# ─── Ana Giriş ────────────────────────────────────────────────────────────────
async def main():
    global _bot_ref

    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("DISCORD_BOT_TOKEN bulunamadı!")
        sys.exit(1)

    await _uptime_server()

    try:
        await database.init_db()
        log.info("Veritabanı tabloları hazır.")
    except Exception as e:
        log.error(f"Veritabanı başlatma hatası: {e}", exc_info=True)

    bot = TurkLigiBot()
    _bot_ref = bot

    try:
        async with bot:
            await bot.start(token)
    except discord.LoginFailure:
        log.error("Geçersiz Discord token.")
        sys.exit(1)
    except Exception as e:
        log.error(f"Bot başlatma hatası: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await database.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
