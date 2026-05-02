import { EmbedBuilder, type ColorResolvable } from "discord.js";

const PRIMARY = 0xe50914;
const SUCCESS = 0x2ecc71;
const ERROR = 0xe74c3c;
const INFO = 0x3498db;

export function primaryEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(PRIMARY).setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(SUCCESS).setTitle(`✅ ${title}`);
  if (description) e.setDescription(description);
  return e;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(ERROR).setTitle(`❌ ${title}`);
  if (description) e.setDescription(description);
  return e;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(INFO).setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

export function teamColor(hex: string | null | undefined): ColorResolvable {
  if (!hex) return PRIMARY;
  const cleaned = hex.replace("#", "");
  const parsed = parseInt(cleaned, 16);
  if (Number.isNaN(parsed)) return PRIMARY;
  return parsed as ColorResolvable;
}
