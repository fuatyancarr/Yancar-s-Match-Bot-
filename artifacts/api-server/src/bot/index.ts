import {
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
} from "discord.js";
import { logger } from "../lib/logger";
import { buildCommandCollection, registerSlashCommands } from "./registry";

export async function startDiscordBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN tanımlı değil. Bot başlatılamadı.");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const commands = buildCommandCollection();

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag }, "Discord botu hazır");
    await registerSlashCommands(client);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error(
          { err, command: interaction.commandName },
          "Autocomplete hatası",
        );
        try {
          if (!interaction.responded) await interaction.respond([]);
        } catch {
          /* noop */
        }
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn(
        { name: interaction.commandName },
        "Bilinmeyen komut çalıştırıldı",
      );
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(
        { err, command: interaction.commandName },
        "Komut yürütme hatası",
      );
      const errorMsg = {
        content:
          "❌ Komut çalıştırılırken beklenmedik bir hata oluştu. Lütfen tekrar deneyin.",
        ephemeral: true,
      };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      } catch (replyErr) {
        logger.error({ err: replyErr }, "Hata mesajı gönderilemedi");
      }
    }
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord client hatası");
  });

  try {
    await client.login(token);
  } catch (err) {
    logger.error({ err }, "Discord bot girişi başarısız");
  }
}
