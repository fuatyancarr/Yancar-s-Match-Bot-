"""Herkese açık komutlar."""
from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
from datetime import datetime, timezone
import db
from config import (
    TRAININGS_PER_GEN, TRAINING_COOLDOWN_SECS,
    DEFAULT_START_GEN, MAX_GEN, SEASON_END_GEN_DECAY,
    get_formation_or_default, formation_analysis, POSITION_ICONS,
    position_category,
)
from utils.embeds import (
    primary_embed, error_embed, info_embed, success_embed, team_color,
)


class PublicCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ─── /yardim ─────────────────────────────────────────────────────────────
    @app_commands.command(name="yardim", description="Botun komutlarını ve nasıl çalıştığını gösterir")
    async def yardim(self, interaction: discord.Interaction):
        cooldown_h = round(TRAINING_COOLDOWN_SECS / 3600)
        e = primary_embed("⚽ Türk Ligi Botu — Komutlar")
        e.description = (
            f"Maçlar **Baz Reyting + Ev Avantajı (+3) + Taktik Boostu = GPR** formülüyle simüle edilir.\n"
            f"Oyuncular **{DEFAULT_START_GEN} GEN** ile başlar, antrenmanla yükselir (max **{MAX_GEN}**), "
            f"her sezon sonunda **-{SEASON_END_GEN_DECAY} GEN** kaybeder."
        )
        e.add_field(
            name="📊 Lig & Bilgi",
            value=(
                "`/takim-listesi` Tüm takımlar\n"
                "`/takim-bilgi <takım>` Takım detayı\n"
                "`/kadro <takım>` Takım kadrosu\n"
                "`/puan-tablosu` Lig puan durumu\n"
                "`/gol-krallari` Gol krallığı\n"
                "`/son-maclar` Son maçlar"
            ), inline=False,
        )
        e.add_field(
            name="💪 Antrenman & GEN",
            value=(
                f"`/antrenman` Antrenman yap ({cooldown_h} saatlik bekleme, her antrenmanda +1 puan, {TRAININGS_PER_GEN} antrenman = +1 GEN)\n"
                "`/genarttir <oyuncu>` GEN +1 (yetkili)\n"
                "`/gendusur <oyuncu>` GEN -1 (yetkili)\n"
                "`/genayarla <oyuncu> <gen>` GEN ayarla (yetkili)"
            ), inline=False,
        )
        e.add_field(
            name="📋 Taktik & Kadro",
            value=(
                "`/taktik-belirle <takım> <diziliş>` Takım dizilişi (yönetici)\n"
                "`/taktik-bilgi <takım>` Aktif taktik\n"
                "`/kadro-ekle <takım> <görsel>` 11'i AI ile görselden çıkar (yönetici)"
            ), inline=False,
        )
        e.add_field(
            name="👮 Yönetici Komutları",
            value=(
                "`/takim-ekle` Yeni takım (Discord rolü zorunlu)\n"
                "`/oyuncu-ekle` Yeni oyuncu (mevki zorunlu)\n"
                "`/mac-yap <ev> <deplasman>` Maç simüle et (kadrolar zorunlu)\n"
                "`/transfer <oyuncu> <takım>` Oyuncu transferi\n"
                "`/reyting-guncelle <takım> <reyting>` Baz reyting\n"
                "`/yetkili-rol ekle/cikar/listele` GEN yetkili roller\n"
                f"`/sezon-baslat <onay>` Yeni sezon (-{SEASON_END_GEN_DECAY} GEN herkese)"
            ), inline=False,
        )
        e.add_field(
            name="🧮 GPR Formülü",
            value=(
                "**GPR** = Baz Reyting + Ev Avantajı (+3 / 0) + Taktik Boostu (+1 → +6)\n\n"
                "**Örnek:**\n"
                "Kocaelispor (Ev): 65 + 3 + 4 = **72 GPR**\n"
                "Fenerbahçe (Dep): 80 + 0 + 2 = **82 GPR**"
            ), inline=False,
        )
        e.add_field(
            name="🏷️ Discord Takma Adı",
            value="Format: `İsim ┃ GENg ┃ MEVKİ` (örn. `A. Yılmaz ┃ 67G ┃ FRV`). Otomatik güncellenir.",
            inline=False,
        )
        e.set_footer(text="Türk Ligi Bot • Powered by Gemini AI")
        await interaction.response.send_message(embed=e)

    # ─── /takim-listesi ───────────────────────────────────────────────────────
    @app_commands.command(name="takim-listesi", description="Ligedeki tüm takımları gösterir")
    async def takim_listesi(self, interaction: discord.Interaction):
        teams = await db.list_teams()
        if not teams:
            await interaction.response.send_message(
                embed=info_embed("Takım Yok", "Henüz hiç takım eklenmemiş. `/takim-ekle` ile başlayın.")
            )
            return
        lines = []
        for t in teams:
            f = get_formation_or_default(t.get("formation"))
            lines.append(f"`{t['base_rating']:>2}` **{t['name']}** ({t['short_name']}) — {f.label} (+{f.tactic_boost})")
        e = primary_embed(f"🏆 Türk Ligi — {len(teams)} Takım")
        e.description = "\n".join(lines)
        await interaction.response.send_message(embed=e)

    # ─── /takim-bilgi (autocomplete) ──────────────────────────────────────────
    @app_commands.command(name="takim-bilgi", description="Bir takımın tüm bilgilerini gösterir")
    @app_commands.describe(takim="Takım adı")
    async def takim_bilgi(self, interaction: discord.Interaction, takim: str):
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}` adında takım yok."), ephemeral=True
            )
            return
        squad = await db.get_team_squad(team["id"])
        lineup = await db.get_lineup_players(team)
        f = get_formation_or_default(team.get("formation"))
        avg_gen = round(sum(p["rating"] for p in squad) / len(squad)) if squad else 0
        gd = team["goals_for"] - team["goals_against"]

        e = primary_embed(f"{team['name']} ({team['short_name']})")
        e.color = team_color(team.get("color"))
        if team.get("discord_role_id"):
            e.description = f"🏷️ Takım Rolü: <@&{team['discord_role_id']}>"
        e.add_field(name="📊 Baz Reyting", value=f"**{team['base_rating']}**", inline=True)
        e.add_field(name="👥 Kadro", value=f"{len(squad)} oyuncu (Ort. GEN: {avg_gen})", inline=True)
        e.add_field(name="📋 Diziliş", value=f"{f.label} (+{f.tactic_boost})", inline=True)
        gd_str = f"+{gd}" if gd >= 0 else str(gd)
        e.add_field(
            name="🏆 Lig Sıralaması",
            value=(f"**{team['points']}** puan • **{team['matches_played']}** maç\n"
                   f"{team['wins']} G - {team['draws']} B - {team['losses']} M\n"
                   f"Averaj: {gd_str} ({team['goals_for']} A - {team['goals_against']} Y)"),
            inline=False,
        )
        e.add_field(
            name="🟢 Maç Kadrosu",
            value="Hazır (11/11)" if lineup else "⚠️ Ayarlanmamış (`/kadro-ekle`)",
            inline=False,
        )
        if squad:
            top5 = sorted(squad, key=lambda p: p["rating"], reverse=True)[:5]
            e.add_field(
                name="⭐ Öne Çıkan Oyuncular",
                value="\n".join(f"`{p['rating']}` `{p['position']}` **{p['name']}** — {p['goals']}G {p['assists']}A" for p in top5),
                inline=False,
            )
        e.set_footer(text=f"Takım ID: {team['id']}")
        await interaction.response.send_message(embed=e)

    @takim_bilgi.autocomplete("takim")
    async def takim_bilgi_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /kadro ───────────────────────────────────────────────────────────────
    @app_commands.command(name="kadro", description="Bir takımın kadrosunu gösterir")
    @app_commands.describe(takim="Takım adı")
    async def kadro(self, interaction: discord.Interaction, takim: str):
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        squad = await db.get_team_squad(team["id"])
        if not squad:
            await interaction.response.send_message(
                embed=info_embed(f"{team['name']} Kadrosu", "Henüz oyuncu yok. `/oyuncu-ekle` ile ekleyin.")
            )
            return
        grouped = {"GK": [], "DEF": [], "MID": [], "FWD": []}
        for p in squad:
            cat = position_category(p["position"])
            grouped[cat].append(p)
        lineup = await db.get_lineup_players(team)
        f = get_formation_or_default(team.get("formation"))
        avg_gen = round(sum(p["rating"] for p in squad) / len(squad))

        e = primary_embed(f"{team['name']} — Tüm Oyuncular ({len(squad)})")
        e.color = team_color(team.get("color"))
        e.description = (
            f"📊 Baz reyting: **{team['base_rating']}** • Ortalama GEN: **{avg_gen}**\n"
            f"📋 Diziliş: **{f.label}** (+{f.tactic_boost})\n" +
            ("✅ Maç kadrosu hazır (11/11)" if lineup else "⚠️ Maç kadrosu ayarlanmamış. `/kadro-ekle` kullanın.")
        )
        for cat in ("GK", "DEF", "MID", "FWD"):
            players = grouped[cat]
            if not players:
                continue
            lines = []
            for p in players:
                uid = p.get("discord_user_id")
                mention = f" (<@{uid}>)" if uid else ""
                lines.append(f"`{p['rating']}` `{p['position']}` **{p['name']}**{mention} — {p['goals']}G {p['assists']}A")
            e.add_field(
                name=f"{POSITION_ICONS[cat]} {cat} ({len(players)})",
                value="\n".join(lines)[:1024], inline=False,
            )
        if lineup:
            lu_lines = "\n".join(f"{i+1}. `{p['position']}` {p['name']} (G{p['rating']})" for i, p in enumerate(lineup))
            e.add_field(name=f"🟢 Aktif Maç Kadrosu ({f.label})", value=lu_lines[:1024], inline=False)
        await interaction.response.send_message(embed=e)

    @kadro.autocomplete("takim")
    async def kadro_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /taktik-bilgi ────────────────────────────────────────────────────────
    @app_commands.command(name="taktik-bilgi", description="Bir takımın aktif taktik dizilişini gösterir")
    @app_commands.describe(takim="Takım adı")
    async def taktik_bilgi(self, interaction: discord.Interaction, takim: str):
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        f = get_formation_or_default(team.get("formation"))
        e = primary_embed(f"📋 {team['name']} — Taktik")
        e.color = team_color(team.get("color"))
        e.description = (
            f"**Diziliş:** {f.label}\n"
            f"**Stil:** {f.style}\n"
            f"**Taktik Boostu:** +{f.tactic_boost}\n\n"
            f"{formation_analysis(f)}\n\n"
            f"📐 {f.gk} Kaleci • {f.defenders} Defans • {f.midfielders} Orta Saha • {f.forwards} Forvet"
        )
        await interaction.response.send_message(embed=e)

    @taktik_bilgi.autocomplete("takim")
    async def taktik_bilgi_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /puan-tablosu ────────────────────────────────────────────────────────
    @app_commands.command(name="puan-tablosu", description="Lig puan durumunu gösterir")
    async def puan_tablosu(self, interaction: discord.Interaction):
        teams = await db.league_table()
        if not teams:
            await interaction.response.send_message(
                embed=info_embed("Puan Tablosu Boş", "Henüz maç oynanmamış.")
            )
            return
        header = "`#  Takım             O    G  B  M  AV  Puan`"
        lines = [header]
        for i, t in enumerate(teams, 1):
            gd = t["goals_for"] - t["goals_against"]
            gd_str = f"+{gd}" if gd > 0 else str(gd)
            name = t["short_name"][:8].ljust(8)
            lines.append(
                f"`{i:>2}. {name}  {t['matches_played']:>2}   {t['wins']}  {t['draws']}  {t['losses']}  {gd_str:>3}   {t['points']:>3}`"
            )
        e = primary_embed("🏆 Puan Tablosu")
        e.description = "\n".join(lines)
        await interaction.response.send_message(embed=e)

    # ─── /gol-krallari ────────────────────────────────────────────────────────
    @app_commands.command(name="gol-krallari", description="En çok gol atan oyuncuları listeler")
    async def gol_krallari(self, interaction: discord.Interaction):
        scorers = await db.top_scorers(15)
        if not scorers:
            await interaction.response.send_message(
                embed=info_embed("Henüz Gol Yok", "Hiç maç oynanmamış.")
            )
            return
        medals = ["🥇", "🥈", "🥉"]
        lines = []
        for i, row in enumerate(scorers):
            medal = medals[i] if i < 3 else f"**{i+1}.**"
            lines.append(f"{medal} **{row['name']}** _({row['team_short']})_ — **{row['goals']}** gol, {row['assists']} asist")
        await interaction.response.send_message(
            embed=primary_embed("👑 Gol Kralları", "\n".join(lines))
        )

    # ─── /son-maclar ──────────────────────────────────────────────────────────
    @app_commands.command(name="son-maclar", description="Son 10 maçı gösterir")
    async def son_maclar(self, interaction: discord.Interaction):
        matches = await db.recent_matches(10)
        if not matches:
            await interaction.response.send_message(
                embed=info_embed("Maç Yok", "Henüz maç oynanmamış.")
            )
            return
        lines = []
        for m in matches:
            if m["home_score"] > m["away_score"]:
                result = f"**{m['home_short']}** {m['home_score']}-{m['away_score']} {m['away_short']}"
            elif m["away_score"] > m["home_score"]:
                result = f"{m['home_short']} {m['home_score']}-{m['away_score']} **{m['away_short']}**"
            else:
                result = f"{m['home_short']} {m['home_score']}-{m['away_score']} {m['away_short']}"
            ts = m["created_at"].strftime("%d.%m") if m.get("created_at") else ""
            lines.append(f"`{ts}` {result}")
        await interaction.response.send_message(
            embed=primary_embed(f"📅 Son {len(matches)} Maç", "\n".join(lines))
        )

    # ─── /antrenman ───────────────────────────────────────────────────────────
    @app_commands.command(name="antrenman", description="Antrenman yap (saatte bir, +1 puan kazanırsın)")
    async def antrenman(self, interaction: discord.Interaction):
        if not interaction.guild:
            await interaction.response.send_message(
                embed=error_embed("Geçersiz Kanal", "Bu komut sadece sunucuda kullanılabilir."), ephemeral=True
            )
            return
        from config import TRAINING_COOLDOWN_SECS, MAX_GEN
        player = await db.get_player_by_discord_id(str(interaction.user.id))
        if not player:
            await interaction.response.send_message(
                embed=error_embed("Oyuncu Değilsin", "Antrenman yapmak için önce `/oyuncu-ekle` ile kayıt olman gerekiyor."),
                ephemeral=True,
            )
            return
        if player["rating"] >= MAX_GEN:
            await interaction.response.send_message(
                embed=error_embed("Maksimum GEN", f"**{player['name']}** zaten **{MAX_GEN}** GEN'e ulaşmış."),
                ephemeral=True,
            )
            return
        last = player.get("last_training_at")
        if last:
            from datetime import datetime, timezone
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - last).total_seconds()
            remaining = TRAINING_COOLDOWN_SECS - elapsed
            if remaining > 0:
                mins = int(remaining // 60)
                secs = int(remaining % 60)
                cd_str = f"{mins} dakika {secs} saniye" if mins > 0 else f"{secs} saniye"
                await interaction.response.send_message(
                    embed=error_embed("Antrenman Bekleme", f"Henüz tekrar antrenman yapamazsın. Kalan süre: **{cd_str}**"),
                    ephemeral=True,
                )
                return

        await interaction.response.defer()
        result = await db.record_training(player, str(interaction.guild_id))
        old_gen = player["rating"]
        old_count = player["trainings_since_gen"]

        if result["gained_gen"]:
            guild = interaction.guild
            updated = result["player"]
            if guild and updated.get("discord_user_id"):
                try:
                    member = await guild.fetch_member(int(updated["discord_user_id"]))
                    from utils.nickname import extract_base_name, apply_nickname
                    base = extract_base_name(member.display_name) or updated.get("name") or member.name
                    await apply_nickname(member, base, updated["rating"], updated["position"])
                except Exception:
                    pass

        amount = result["amount"]
        new_count = old_count + amount
        lines = [
            f"💪 Antrenmandan **+{amount}** puan kazandın!",
            f"📊 Toplam: `{old_count}` + `{amount}` = `{new_count}` / {TRAININGS_PER_GEN}",
            "",
        ]
        if result["gained_gen"]:
            lines += [
                f"🚀 **GEN ARTIŞI!** `{old_gen}` → `{result['new_gen']}`",
                "🎉 Tebrikler! Yeni GEN ile takma adın güncellendi.",
            ]
        else:
            lines += [
                f"📈 Mevcut GEN: `{result['player']['rating']}`",
                f"⏳ GEN artmak için **{result['trainings_remaining']}** antrenman daha gerekli.",
            ]
        lines.append("")
        lines.append("⏰ Bir sonraki antrenman: **1 saat** sonra")

        desc = "\n".join(lines)
        if result["gained_gen"]:
            e = success_embed(f"🏋️ {player['name']} — Antrenman Tamamlandı", desc)
        else:
            e = primary_embed(f"🏋️ {player['name']} — Antrenman Tamamlandı", desc)
        await interaction.followup.send(embed=e)


async def setup(bot: commands.Bot):
    await bot.add_cog(PublicCog(bot))
