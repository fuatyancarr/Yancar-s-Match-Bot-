import { type Guild, type GuildMember } from "discord.js";
import { logger } from "../../lib/logger";

const MAX_NICK_LEN = 32;

export function formatNickname(
  baseName: string,
  gen: number,
  position: string,
): string {
  const suffix = ` | ${gen} | ${position}`;
  const allowed = MAX_NICK_LEN - suffix.length;
  if (allowed <= 0) {
    return baseName.slice(0, MAX_NICK_LEN);
  }
  const trimmed = baseName.length > allowed ? baseName.slice(0, allowed).trim() : baseName;
  return `${trimmed}${suffix}`;
}

export function extractBaseName(currentNick: string | null | undefined): string | null {
  if (!currentNick) return null;
  const idx = currentNick.indexOf(" | ");
  if (idx === -1) return currentNick;
  return currentNick.slice(0, idx).trim();
}

export async function fetchMember(
  guild: Guild | null | undefined,
  userId: string,
): Promise<GuildMember | null> {
  if (!guild) return null;
  try {
    return await guild.members.fetch(userId);
  } catch (err) {
    logger.warn({ err, userId }, "Üye getirilemedi");
    return null;
  }
}

export async function applyNickname(
  member: GuildMember,
  baseName: string,
  gen: number,
  position: string,
): Promise<{ ok: boolean; reason?: string; nickname: string }> {
  const nick = formatNickname(baseName, gen, position);
  try {
    await member.setNickname(nick, "Türk Ligi Bot — oyuncu kaydı/güncellemesi");
    return { ok: true, nickname: nick };
  } catch (err) {
    const msg = (err as Error).message ?? "bilinmeyen hata";
    logger.warn(
      { err, userId: member.id, nick },
      "Discord takma adı değiştirilemedi",
    );
    return { ok: false, reason: msg, nickname: nick };
  }
}
