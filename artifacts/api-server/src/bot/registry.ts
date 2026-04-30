import { Collection, REST, Routes, type Client } from "discord.js";
import { logger } from "../lib/logger";
import type { SlashCommand } from "./commands/types";

import { command as takimEkle } from "./commands/takim-ekle";
import { command as takimBilgi } from "./commands/takim-bilgi";
import { command as takimListesi } from "./commands/takim-listesi";
import { command as oyuncuEkle } from "./commands/oyuncu-ekle";
import { command as kadro } from "./commands/kadro";
import { command as taktikYukle } from "./commands/taktik-yukle";
import { command as taktikBilgi } from "./commands/taktik-bilgi";
import { command as macYap } from "./commands/mac-yap";
import { command as puanTablosu } from "./commands/puan-tablosu";
import { command as golKrallari } from "./commands/gol-krallari";
import { command as sonMaclar } from "./commands/son-maclar";
import { command as transfer } from "./commands/transfer";
import { command as reytingGuncelle } from "./commands/reyting-guncelle";
import { command as sezonBaslat } from "./commands/sezon-baslat";
import { command as yardim } from "./commands/yardim";

export const allCommands: SlashCommand[] = [
  yardim,
  takimEkle,
  takimBilgi,
  takimListesi,
  oyuncuEkle,
  kadro,
  taktikYukle,
  taktikBilgi,
  macYap,
  puanTablosu,
  golKrallari,
  sonMaclar,
  transfer,
  reytingGuncelle,
  sezonBaslat,
];

export function buildCommandCollection(): Collection<string, SlashCommand> {
  const c = new Collection<string, SlashCommand>();
  for (const cmd of allCommands) {
    c.set(cmd.data.name, cmd);
  }
  return c;
}

export async function registerSlashCommands(client: Client): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token || !client.user) {
    logger.warn("Slash komut kaydı için bot kullanıcısı veya token yok");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  const body = allCommands.map((c) => c.data.toJSON());
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    logger.info({ count: body.length }, "Slash komutlar global olarak kaydedildi");
  } catch (err) {
    logger.error({ err }, "Slash komut kaydı başarısız");
  }
}
