"""Yönetici komutları."""
from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
import db
from config import (
    DEFAULT_START_GEN, MAX_GEN, SEASON_END_GEN_DECAY,
    FORMATION_CHOICES, find_formation, get_formation_or_default,
    formation_analysis, position_category,
)
from utils.embeds import success_embed, error_embed, primary_embed, info_embed, team_color
from utils.permissions import require_admin, require_gen_authorized
from utils.nickname import apply_nickname, extract_base_name, sync_player_nickname


# ─── Yetkili-Rol grup ─────────────────────────────────────────────────────────
class YetkiliRolGroup(app_commands.Group):
    def __init__(self):
        super().__init__(name="yetkili-rol", description="GEN değiştirme yetkisi olan rolleri yönetir (Sadece Yönetici)")

    @app_commands.command(name="ekle", description="Bir rolü GEN yetkili rollerine ekler")
    @app_commands.describe(rol="Yetki verilecek rol")
    async def ekle(self, interaction: discord.Interaction, rol: discord.Role):
        if not await require_admin(interaction):
            return
        await db.add_authorized_role(str(interaction.guild_id), str(rol.id))
        await interaction.response.send_message(
            embed=success_embed("Rol Eklendi", f"<@&{rol.id}> rolü artık GEN değiştirme yetkisine sahip.")
        )

    @app_commands.command(name="cikar", description="Bir rolü GEN yetkili rollerinden çıkarır")
    @app_commands.describe(rol="Yetkisi alınacak rol")
    async def cikar(self, interaction: discord.Interaction, rol: discord.Role):
        if not await require_admin(interaction):
            return
        await db.remove_authorized_role(str(interaction.guild_id), str(rol.id))
        await interaction.response.send_message(
            embed=success_embed("Rol Çıkarıldı", f"<@&{rol.id}> rolünün GEN yetkisi kaldırıldı.")
        )

    @app_commands.command(name="listele", description="Tüm GEN yetkili rolleri listeler")
    async def listele(self, interaction: discord.Interaction):
        rows = await db.list_authorized_roles(str(interaction.guild_id))
        if not rows:
            await interaction.response.send_message(
                embed=primary_embed(
                    "GEN Yetkili Roller",
                    "Henüz GEN yetkili rolü ayarlanmamış. `/yetkili-rol ekle` ile rol ekleyin.\n\n"
                    "_Yönetici yetkisine sahip kişiler her zaman GEN komutlarını kullanabilir._",
                )
            )
            return
        lines = "\n".join(f"• <@&{r['role_id']}>" for r in rows)
        await interaction.response.send_message(
            embed=primary_embed(
                f"GEN Yetkili Roller ({len(rows)})",
                f"{lines}\n\n_Yönetici yetkisine sahip kişiler her zaman GEN komutlarını kullanabilir._",
            )
        )


# ─── AdminCog ─────────────────────────────────────────────────────────────────
class AdminCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.yetkili_rol = YetkiliRolGroup()
        bot.tree.add_command(self.yetkili_rol)

    # ─── /takim-ekle ─────────────────────────────────────────────────────────
    @app_commands.command(name="takim-ekle", description="Lige yeni bir takım ekler (Sadece Yönetici)")
    @app_commands.describe(
        isim="Takımın tam adı (örn: Kocaelispor)",
        kisa_isim="Takımın kısa adı (örn: KOC)",
        rol="Takım Discord rolü",
        baz_reyting="Takımın baz reytingi (50-95)",
        renk="Takım rengi hex (örn: #1f4ea1)",
    )
    async def takim_ekle(
        self,
        interaction: discord.Interaction,
        isim: str,
        kisa_isim: str,
        rol: discord.Role,
        baz_reyting: app_commands.Range[int, 50, 95],
        renk: str = "#1f4ea1",
    ):
        if not await require_admin(interaction):
            return
        color = renk if renk.startswith("#") else f"#{renk}"
        try:
            team = await db.insert_team(
                isim.strip(), kisa_isim.strip().upper(),
                str(rol.id), str(interaction.guild_id),
                baz_reyting, color,
            )
            await interaction.response.send_message(
                embed=success_embed(
                    "Takım Eklendi",
                    f"**{team['name']}** ({team['short_name']}) lige başarıyla eklendi.\n\n"
                    f"📊 **Baz Reyting:** {team['base_rating']}\n"
                    f"🎨 **Renk:** {team['color']}\n"
                    f"🎭 **Rol:** <@&{rol.id}>\n"
                    f"⚽ **Diziliş:** {team.get('formation', '4-4-2')}\n\n"
                    f"🆔 Takım ID: `{team['id']}`",
                )
            )
        except Exception as err:
            msg = str(err)
            is_dup = "unique" in msg.lower() or "duplicate" in msg.lower()
            await interaction.response.send_message(
                embed=error_embed(
                    "Takım Eklenemedi",
                    f"Bu isimde veya kısa isimde bir takım zaten var." if is_dup else f"Hata: {msg}",
                ),
                ephemeral=True,
            )

    # ─── /oyuncu-ekle ────────────────────────────────────────────────────────
    @app_commands.command(name="oyuncu-ekle", description="Bir takıma oyuncu ekler (Sadece Yönetici)")
    @app_commands.describe(
        takim="Takım adı",
        kullanici="Oyuncu olacak Discord kullanıcısı",
        mevki="Oyuncunun mevkii",
        isim="Opsiyonel: özel oyuncu adı",
    )
    async def oyuncu_ekle(
        self,
        interaction: discord.Interaction,
        takim: str,
        kullanici: discord.Member,
        mevki: str,
        isim: str | None = None,
    ):
        if not await require_admin(interaction):
            return
        from config import find_position
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        pos = find_position(mevki)
        if not pos:
            await interaction.response.send_message(
                embed=error_embed("Geçersiz Mevki", f"Bilinmeyen mevki kodu: `{mevki}`"), ephemeral=True
            )
            return
        existing = await db.get_player_by_discord_id(str(kullanici.id))
        if existing:
            await interaction.response.send_message(
                embed=error_embed(
                    "Kullanıcı Zaten Kayıtlı",
                    f"<@{kullanici.id}> zaten `{existing['name']}` olarak kayıtlı (ID: `{existing['id']}`).",
                ),
                ephemeral=True,
            )
            return
        base_name = (isim and isim.strip()) or kullanici.display_name or kullanici.name
        player = await db.insert_player(
            team["id"], str(kullanici.id), str(interaction.guild_id),
            base_name, pos.code, DEFAULT_START_GEN,
        )
        nick_ok, nick_str, nick_err = await apply_nickname(kullanici, base_name, DEFAULT_START_GEN, pos.code)
        lines = [
            f"<@{kullanici.id}> → **{player['name']}** ({pos.label})",
            f"🏟️ **{team['name']}** kadrosuna katıldı.",
            f"",
            f"📊 **Başlangıç GEN:** `{DEFAULT_START_GEN}` / {MAX_GEN}",
            f"📍 **Mevki:** `{pos.code}` ({pos.label})",
            f"🆔 Oyuncu ID: `{player['id']}`",
        ]
        if nick_ok:
            lines.append(f"\n✏️ Discord takma adı ayarlandı: `{nick_str}`")
        elif nick_err:
            lines.append(f"\n⚠️ Takma ad değiştirilemedi: {nick_err}\nManüel: `{nick_str}`")
        await interaction.response.send_message(
            embed=success_embed("Oyuncu Eklendi", "\n".join(lines))
        )

    @oyuncu_ekle.autocomplete("takim")
    async def oyuncu_ekle_takim_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    @oyuncu_ekle.autocomplete("mevki")
    async def oyuncu_ekle_mevki_ac(self, interaction: discord.Interaction, current: str):
        from config import POSITIONS
        return [
            app_commands.Choice(name=f"{p.label} ({p.code})", value=p.code)
            for p in POSITIONS
            if current.upper() in p.code or current.lower() in p.label.lower()
        ][:25]

    # ─── /mac-yap ────────────────────────────────────────────────────────────
    @app_commands.command(name="mac-yap", description="İki takım arasında maç simülasyonu (Sadece Yönetici)")
    @app_commands.describe(ev="Ev sahibi takım", deplasman="Deplasman takımı")
    async def mac_yap(self, interaction: discord.Interaction, ev: str, deplasman: str):
        if not await require_admin(interaction):
            return
        if ev == deplasman:
            await interaction.response.send_message(
                embed=error_embed("Geçersiz Eşleşme", "Bir takım kendisiyle maç yapamaz."), ephemeral=True
            )
            return
        home = await db.find_team_by_name(ev)
        away = await db.find_team_by_name(deplasman)
        if not home:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"Ev sahibi: `{ev}`"), ephemeral=True
            )
            return
        if not away:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"Deplasman: `{deplasman}`"), ephemeral=True
            )
            return
        await interaction.response.defer()
        try:
            from services.match import simulate_match
            result = await simulate_match(home["id"], away["id"])
        except Exception as err:
            await interaction.followup.send(embed=error_embed("Maç Yapılamadı", str(err)))
            return

        hf = result["home_formation"]
        af = result["away_formation"]

        gpr_e = primary_embed(f"📋 Maç Hazırlığı: {home['short_name']} vs {away['short_name']}")
        gpr_e.color = team_color(home.get("color"))
        gpr_e.add_field(
            name=f"🏠 {home['name']}",
            value=(f"Baz: **{home['base_rating']}** + Ev: **+3** + Taktik: **+{result['home_tactic_score']}**\n"
                   f"→ **GPR: {result['home_gpr']}** ({hf.label})"),
            inline=False,
        )
        gpr_e.add_field(
            name=f"✈️ {away['name']}",
            value=(f"Baz: **{away['base_rating']}** + Ev: **+0** + Taktik: **+{result['away_tactic_score']}**\n"
                   f"→ **GPR: {result['away_gpr']}** ({af.label})"),
            inline=False,
        )

        events = result["events"]
        event_lines: list[str] = []
        first_half_shown = False
        for ev_item in events:
            if not first_half_shown and ev_item["minute"] > 45:
                event_lines.append("**⏸️ Devre Arası**")
                first_half_shown = True
            icon = "•"
            if ev_item["type"] == "GOL":
                icon = "🏠⚽" if ev_item["team"] == "ev" else "✈️⚽"
            elif ev_item["type"] == "SARI_KART":
                icon = "🟨"
            elif ev_item["type"] == "KIRMIZI_KART":
                icon = "🟥"
            event_lines.append(f"`{ev_item['minute']}'` {icon} {ev_item['description']}")
        if not first_half_shown:
            event_lines.append("**⏸️ Devre Arası**")
        event_lines.append("**🔚 Maç Sonu**")
        events_text = "\n".join(event_lines)[:4000]

        hs, as_ = result["home_score"], result["away_score"]
        if hs > as_:
            win_color = team_color(home.get("color"))
        elif as_ > hs:
            win_color = team_color(away.get("color"))
        else:
            win_color = 0xf1c40f

        final_e = discord.Embed(
            title=f"🏆 {home['short_name']} {hs} — {as_} {away['short_name']}",
            description=result["narrative"],
            color=win_color,
        )
        poss = result["possession"]
        final_e.add_field(
            name="📊 Maç İstatistikleri",
            value=(f"Topla Oynama: **%{poss}** - **%{100-poss}**\n"
                   f"Şut: **{result['home_shots']}** - **{result['away_shots']}**\n"
                   f"İsabetli Şut: **{result['home_on']}** - **{result['away_on']}**"),
            inline=False,
        )
        final_e.add_field(name="📜 Maç Olayları", value=events_text, inline=False)
        final_e.set_footer(text=f"Maç ID: {result['match_id']} • GPR {result['home_gpr']} - {result['away_gpr']}")
        final_e.timestamp = discord.utils.utcnow()

        await interaction.followup.send(embeds=[gpr_e, final_e])

    @mac_yap.autocomplete("ev")
    async def mac_yap_ev_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    @mac_yap.autocomplete("deplasman")
    async def mac_yap_dep_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /transfer ───────────────────────────────────────────────────────────
    @app_commands.command(name="transfer", description="Bir oyuncuyu başka takıma transfer eder (Sadece Yönetici)")
    @app_commands.describe(oyuncu="Transfer edilecek Discord kullanıcısı", yeni_takim="Yeni takım adı")
    async def transfer(self, interaction: discord.Interaction, oyuncu: discord.Member, yeni_takim: str):
        if not await require_admin(interaction):
            return
        team = await db.find_team_by_name(yeni_takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{yeni_takim}`"), ephemeral=True
            )
            return
        player = await db.get_player_by_discord_id(str(oyuncu.id))
        if not player:
            await interaction.response.send_message(
                embed=error_embed("Oyuncu Bulunamadı", f"<@{oyuncu.id}> kayıtlı bir oyuncu değil."),
                ephemeral=True,
            )
            return
        if player["team_id"] == team["id"]:
            await interaction.response.send_message(
                embed=error_embed("Aynı Takım", f"**{player['name']}** zaten **{team['name']}** kadrosunda."),
                ephemeral=True,
            )
            return
        updated = await db.update_player_team(player["id"], team["id"])
        await sync_player_nickname(interaction.guild, updated)
        await interaction.response.send_message(
            embed=success_embed(
                "Transfer Tamamlandı",
                f"<@{oyuncu.id}> **{player['name']}** artık **{team['name']}** kadrosunda.",
            )
        )

    @transfer.autocomplete("yeni_takim")
    async def transfer_takim_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /reyting-guncelle ───────────────────────────────────────────────────
    @app_commands.command(name="reyting-guncelle", description="Bir takımın baz reytingini günceller (Sadece Yönetici)")
    @app_commands.describe(takim="Takım adı", yeni_reyting="Yeni baz reyting (50-95)")
    async def reyting_guncelle(
        self,
        interaction: discord.Interaction,
        takim: str,
        yeni_reyting: app_commands.Range[int, 50, 95],
    ):
        if not await require_admin(interaction):
            return
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        await db.update_team_base_rating(team["id"], yeni_reyting)
        await interaction.response.send_message(
            embed=success_embed(
                "Reyting Güncellendi",
                f"**{team['name']}** baz reytingi: `{team['base_rating']}` → `{yeni_reyting}`",
            )
        )

    @reyting_guncelle.autocomplete("takim")
    async def reyting_takim_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    # ─── /sezon-baslat ───────────────────────────────────────────────────────
    @app_commands.command(name="sezon-baslat", description=f"Yeni sezon: istatistikler sıfırlanır, tüm oyunculara -{SEASON_END_GEN_DECAY} GEN uygulanır")
    @app_commands.describe(onay="İşlemi onaylıyor musun? (Geri alınamaz)")
    async def sezon_baslat(self, interaction: discord.Interaction, onay: bool):
        if not await require_admin(interaction):
            return
        if not onay:
            await interaction.response.send_message("İşlem iptal edildi.", ephemeral=True)
            return
        await interaction.response.defer()
        await db.delete_all_matches()
        await db.reset_all_team_stats()
        affected = await db.apply_season_decay()

        players = await db.all_players_with_discord()
        synced = 0
        for p in players:
            if p.get("discord_user_id") and interaction.guild:
                await sync_player_nickname(interaction.guild, p)
                synced += 1

        await interaction.followup.send(
            embed=success_embed(
                "🏆 Yeni Sezon Başladı",
                f"Tüm takım ve oyuncu istatistikleri sıfırlandı. Tüm maç geçmişi silindi.\n\n"
                f"📉 **{affected}** oyuncuya **-{SEASON_END_GEN_DECAY}** GEN uygulandı.\n"
                f"✏️ **{synced}** oyuncunun Discord takma adı güncellendi.\n\n"
                f"Bol şans! ⚽",
            )
        )

    # ─── /taktik-belirle ─────────────────────────────────────────────────────
    @app_commands.command(name="taktik-belirle", description="Bir takımın taktik dizilişini ayarlar (Sadece Yönetici)")
    @app_commands.describe(takim="Takım adı", dizilis="Diziliş kodu")
    async def taktik_belirle(self, interaction: discord.Interaction, takim: str, dizilis: str):
        if not await require_admin(interaction):
            return
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        f = find_formation(dizilis)
        if not f:
            await interaction.response.send_message(
                embed=error_embed("Geçersiz Diziliş", f"`{dizilis}`"), ephemeral=True
            )
            return
        await db.update_team_formation(team["id"], f.code)
        await interaction.response.send_message(
            embed=success_embed(
                "Taktik Belirlendi",
                f"**{team['name']}** için yeni diziliş: **{f.label}**\n\n"
                f"📐 **Sistem:** {f.code} ({f.style})\n"
                f"⚡ **Taktik Boostu:** +{f.tactic_boost}\n"
                f"📋 **Mevki Sayısı:** {f.gk} GK / {f.defenders} DEF / {f.midfielders} MID / {f.forwards} FWD\n\n"
                f"{formation_analysis(f)}",
            )
        )

    @taktik_belirle.autocomplete("takim")
    async def taktik_belirle_takim_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]

    @taktik_belirle.autocomplete("dizilis")
    async def taktik_belirle_dizilis_ac(self, interaction: discord.Interaction, current: str):
        from config import FORMATIONS
        return [
            app_commands.Choice(name=f"{f.label} • +{f.tactic_boost}", value=f.code)
            for f in FORMATIONS
            if current.lower() in f.code.lower() or current.lower() in f.label.lower()
        ][:25]

    # ─── /kadro-ekle ─────────────────────────────────────────────────────────
    @app_commands.command(name="kadro-ekle", description="Takım maç kadrosunu görselden AI ile çıkarır (Sadece Yönetici)")
    @app_commands.describe(
        takim="Kadrosu ayarlanacak takım",
        gorsel="11 kişilik kadro görseli",
        dizilis="Opsiyonel: manuel diziliş kodu (örn: 4-3-3)",
    )
    async def kadro_ekle(
        self,
        interaction: discord.Interaction,
        takim: str,
        gorsel: discord.Attachment,
        dizilis: str | None = None,
    ):
        if not await require_admin(interaction):
            return
        team = await db.find_team_by_name(takim)
        if not team:
            await interaction.response.send_message(
                embed=error_embed("Takım Bulunamadı", f"`{takim}`"), ephemeral=True
            )
            return
        if not gorsel.content_type or not gorsel.content_type.startswith("image/"):
            await interaction.response.send_message(
                embed=error_embed("Geçersiz Dosya", "Lütfen görsel formatı (PNG, JPG, WebP) yükleyin."),
                ephemeral=True,
            )
            return
        squad = await db.get_team_squad(team["id"])
        if len(squad) < 11:
            await interaction.response.send_message(
                embed=error_embed(
                    "Yetersiz Kadro",
                    f"**{team['name']}** kadrosunda yalnızca **{len(squad)}** oyuncu var. En az 11 gerekli.",
                ),
                ephemeral=True,
            )
            return
        await interaction.response.defer()
        try:
            from services.lineup import extract_lineup_from_image, match_players_to_squad, save_lineup
            extraction = await extract_lineup_from_image(gorsel.url, gorsel.content_type)
        except Exception as err:
            await interaction.followup.send(
                embed=error_embed("AI Analiz Hatası", f"Görsel analiz edilemedi: {err}")
            )
            return

        if not extraction["player_names"]:
            await interaction.followup.send(
                embed=error_embed(
                    "Oyuncu Bulunamadı",
                    "Görselde oyuncu adı tespit edilemedi. Daha net bir görsel yükleyin.",
                )
            )
            return

        match_result = match_players_to_squad(extraction["player_names"], squad)
        if len(match_result["matched"]) < 11:
            lines = [
                f"Görselden **{len(extraction['player_names'])}** oyuncu adı çıkarıldı, "
                f"ancak yalnızca **{len(match_result['matched'])}** tanesi eşleşti.",
                "",
                "**Eşleşen:**",
            ]
            for m in match_result["matched"]:
                lines.append(f"✅ `{m['extracted_name']}` → **{m['player']['name']}** (%{m['score']})")
            if match_result["unmatched"]:
                lines.append("")
                lines.append("**Eşleşmeyen:**")
                for n in match_result["unmatched"]:
                    lines.append(f"❌ `{n}`")
            lines.append("")
            lines.append("Oyuncu adlarını düzeltin veya tekrar deneyin.")
            await interaction.followup.send(
                embed=error_embed("Kadro Eşleşmesi Yetersiz", "\n".join(lines)[:4000])
            )
            return

        final_eleven = [m["player"] for m in match_result["matched"][:11]]
        formation_code = (
            (dizilis and find_formation(dizilis) and find_formation(dizilis).code)
            or (extraction["formation"] and find_formation(extraction["formation"]) and find_formation(extraction["formation"]).code)
            or team.get("formation", "4-4-2")
        )
        formation = get_formation_or_default(formation_code)

        await save_lineup(team["id"], [p["id"] for p in final_eleven], formation.code)

        lineup_lines = "\n".join(
            f"{i+1}. `{p['position']}` **{p['name']}** — GEN {p['rating']}"
            for i, p in enumerate(final_eleven)
        )
        e = success_embed("Kadro Kaydedildi")
        e2 = primary_embed(f"📋 {team['name']} — Maç Kadrosu Hazır")
        e2.color = team_color(team.get("color"))
        e2.description = (
            f"🤖 AI görseli analiz etti ve **{len(match_result['matched'])}** oyuncu eşleştirdi.\n"
            + (f"_{extraction['raw_analysis']}_\n\n" if extraction.get("raw_analysis") else "")
            + f"📐 **Diziliş:** {formation.label} ({formation.code})\n"
            f"⚡ **Taktik Boostu:** +{formation.tactic_boost}\n\n"
            f"**11 Kişilik Kadro:**\n{lineup_lines}"
        )
        e2.set_footer(text="Maç başlamak için /mac-yap kullanılabilir")
        await interaction.followup.send(embeds=[e, e2])

    @kadro_ekle.autocomplete("takim")
    async def kadro_ekle_takim_ac(self, interaction: discord.Interaction, current: str):
        teams = await db.search_teams(current, 25)
        return [app_commands.Choice(name=f"{t['name']} ({t['short_name']})", value=t["name"]) for t in teams]


async def setup(bot: commands.Bot):
    await bot.add_cog(AdminCog(bot))
