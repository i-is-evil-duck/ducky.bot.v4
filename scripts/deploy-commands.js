require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const config = require('../config.json');
const {
  payload,
  newRest,
  currentApplicationId,
  deployGlobal,
  deployAllGuilds,
  clearGlobal,
  clearGuild,
} = require('../lib/deploy');

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
  const scope = config.deployScope === 'global' ? 'global' : 'guild';

  const rest = newRest(token);
  const clientId = await currentApplicationId(rest);
  const failures = [];

  console.log(`Deploying ${body.length} commands as application ${clientId} (scope: ${scope})`);

  if (scope === 'guild') {
    console.log('\n[global] clearing global commands to avoid duplicates...');
    await clearGlobal(rest, clientId);

    failures.push(...(await deployAllGuilds(rest, clientId, guildIds)));
  } else {
    console.log('\n[global] registering commands...');
    await deployGlobal(rest, clientId);

    for (const guildId of guildIds) {
      try {
        await clearGuild(rest, clientId, guildId);
        console.log(`[guild ${guildId}] cleared guild-scoped copies`);
      } catch (error) {
        failures.push({ guildId, error: error.message });
        console.warn(`[guild ${guildId}] FAILED to clear: ${error.message}`);
      }
    }
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} target(s) failed:`);
    for (const failure of failures) {
      console.log(`  - guild ${failure.guildId}: ${failure.error}`);
    }
    console.log('\nDone with errors.');
    process.exit(1);
  }

  console.log('\nDone.');
  process.exit(0);
})().catch((error) => {
  console.error('Command deployment failed:', error);
  process.exit(1);
});