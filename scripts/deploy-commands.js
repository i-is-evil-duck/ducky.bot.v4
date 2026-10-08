require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const config = require('../config.json');
const { payload, newRest, currentApplicationId, deployGlobal, deployGuild } = require('../lib/deploy');

const token = process.env.TOKEN;

if (!token) {
  console.error('TOKEN is not set. Add it to .env before deploying commands.');
  process.exit(1);
}

function explicitGuilds() {
  return [...new Set([config.devGuildId, ...(config.guildIds ?? [])].filter(Boolean))];
}

async function discoverGuilds() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  try {
    const ids = [...client.guilds.cache.keys()];
    console.log(`Auto-detected ${ids.length} guild(s) from the token.`);
    return ids;
  } finally {
    await client.destroy();
  }
}

(async () => {
  const body = payload();
  const configured = explicitGuilds();
  const guildIds = configured.length > 0 ? configured : await discoverGuilds();

  const rest = newRest(token);
  const clientId = await currentApplicationId(rest);

  console.log(`Deploying ${body.length} commands as application ${clientId}`);

  console.log('\n[global] unregistering existing commands...');
  await deployGlobal(rest, clientId);
  console.log(`[global] registered ${body.length} commands`);

  for (const guildId of guildIds) {
    await deployGuild(rest, clientId, guildId);
    console.log(`[guild ${guildId}] registered ${body.length} commands`);
  }

  console.log('\nDone.');
})().catch((error) => {
  console.error('Command deployment failed:', error);
  process.exit(1);
});