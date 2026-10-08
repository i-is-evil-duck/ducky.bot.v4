require('dotenv').config();

const { Client, Events, GatewayIntentBits, Partials, Collection } = require('discord.js');

const config = require('./config.json');

if (!process.env.TOKEN) {
  console.error('TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction],
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();
client.prefix = config.prefix;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

require('./handlers/slashcommands')(client);
require('./handlers/components')(client);

const { start } = require('./lib/scheduler');

client.once(Events.ClientReady, (ready) => {
  console.log(`🤖 Logged in as ${ready.user.tag} (${ready.user.id})`);
  console.log(`📡 Watching ${ready.guilds.cache.size} guild(s)`);
  start(client);
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    const { deployGuild } = require('./lib/deploy');
    await deployGuild(client.rest, client.user.id, guild.id);
    console.log(`📝 Deployed commands to ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error(`Failed to deploy commands to ${guild.id}:`, error.message);
  }
});

client.login(process.env.TOKEN).catch((error) => {
  console.error('Login failed:', error.message);
  process.exit(1);
});