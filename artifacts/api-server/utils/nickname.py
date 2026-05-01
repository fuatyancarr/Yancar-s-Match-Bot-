"""Discord takma ad yönetimi."""
import discord

MAX_NICK_LEN = 32


def format_nickname(base_name: str, gen: int, position: str) -> str:
    suffix = f" | {gen} | {position}"
    allowed = MAX_NICK_LEN - len(suffix)
    if allowed <= 0:
        return base_name[:MAX_NICK_LEN]
    trimmed = base_name[:allowed].rstrip() if len(base_name) > allowed else base_name
    return f"{trimmed}{suffix}"


def extract_base_name(current_nick: str | None) -> str | None:
    if not current_nick:
        return None
    idx = current_nick.find(" | ")
    if idx == -1:
        return current_nick
    return current_nick[:idx].strip()


async def apply_nickname(
    member: discord.Member, base_name: str, gen: int, position: str
) -> tuple[bool, str, str | None]:
    """Returns (ok, nickname, error_reason)."""
    nick = format_nickname(base_name, gen, position)
    try:
        await member.edit(nick=nick, reason="Türk Ligi Bot — oyuncu güncellemesi")
        return True, nick, None
    except discord.Forbidden:
        return False, nick, "Yetki yetersiz (ManageNicknames)"
    except Exception as e:
        return False, nick, str(e)


async def sync_player_nickname(guild: discord.Guild | None, player: dict):
    if not guild or not player.get("discord_user_id"):
        return
    try:
        member = await guild.fetch_member(int(player["discord_user_id"]))
    except Exception:
        return
    base = extract_base_name(member.display_name) or player.get("name") or member.name
    await apply_nickname(member, base, player["rating"], player["position"])
