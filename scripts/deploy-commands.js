require('dotenv').config();

const { REST, Routes } = require('discord.js');

const config = require('../config.json');
const { collectCommands } = require('../lib/commands');

const token = process.env.TOKEN;

if (!token) {
  console.error('TOKEN is not set. Add it to .env before deploying commands.');
  process.exit(1);
}

const body = collectCommands().map((command) => command.data.toJSON());

const guildIds = [...new Set([config.devGuildId, ...(config.guildIds ?? [])].filter(Boolean))];

function routes(clientId) {
  const targets = [{ scope: 'global', route: Routes.applicationCommands(clientId) }];

  for (const guildId of guildIds) {
    targets.push({ scope: `guild ${guildId}`, route: Routes.applicationGuildCommands(clientId, guildId) });
  }

  return targets;
}

(async () => {
  const rest = new REST({ version: '10' }).setToken(token);

  const application = await rest.get(Routes.oauth2CurrentApplication());
  console.log(`Deploying ${body.length} commands for ${application.name} (${application.id})`);

  for (const { scope, route } of routes(application.id)) {
    console.log(`\n[${scope}] unregistering existing commands...`);
    await rest.put(route, { body: [] });

    console.log(`[${scope}] registering ${body.length} commands...`);
    await rest.put(route, { body });

    console.log(`[${scope}] done`);
  }

  console.log('\nAll commands deployed successfully.');
})().catch((error) => {
  console.error('Command deployment failed:', error);
  process.exit(1);
});