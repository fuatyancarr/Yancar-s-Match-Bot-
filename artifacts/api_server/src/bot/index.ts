import { Client, Events, GatewayIntentBits } from "discord.js";
import { logger } from "../lib/logger";
import { buildCommandCollection, registerSlashCommands } from "./registry";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands = buildCommandCollection();

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`${readyClient.user.tag} olarak giriş yapıldı!`);
  await registerSlashCommands(readyClient.user.id);
  logger.info("Discord botu hazır!");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error, "Komut çalıştırılırken hata oluştu");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);