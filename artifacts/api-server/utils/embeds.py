"""Discord embed yardımcıları."""
import discord


PRIMARY = 0xe50914
SUCCESS = 0x2ecc71
ERROR   = 0xe74c3c
INFO    = 0x3498db


def primary_embed(title: str, description: str | None = None) -> discord.Embed:
    e = discord.Embed(title=title, color=PRIMARY)
    if description:
        e.description = description
    return e


def success_embed(title: str, description: str | None = None) -> discord.Embed:
    e = discord.Embed(title=f"✅ {title}", color=SUCCESS)
    if description:
        e.description = description
    return e


def error_embed(title: str, description: str | None = None) -> discord.Embed:
    e = discord.Embed(title=f"❌ {title}", color=ERROR)
    if description:
        e.description = description
    return e


def info_embed(title: str, description: str | None = None) -> discord.Embed:
    e = discord.Embed(title=title, color=INFO)
    if description:
        e.description = description
    return e


def team_color(hex_color: str | None) -> int:
    if not hex_color:
        return PRIMARY
    cleaned = hex_color.lstrip("#")
    try:
        return int(cleaned, 16)
    except ValueError:
        return PRIMARY
