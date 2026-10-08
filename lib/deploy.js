const { REST, Routes } = require('discord.js');

const { collectCommands } = require('./commands');

function payload() {
  return collectCommands().map((command) => command.data.toJSON());
}

function newRest(token) {
  return new REST({ version: '10' }).setToken(token);
}

async function currentApplicationId(rest) {
  const application = await rest.get(Routes.oauth2CurrentApplication());
  return application.id;
}

async function deployGlobal(rest, clientId, { clearFirst = true } = {}) {
  const route = Routes.applicationCommands(clientId);

  if (clearFirst) await rest.put(route, { body: [] });
  return rest.put(route, { body: payload() });
}

async function deployGuild(rest, clientId, guildId, { clearFirst = true } = {}) {
  const route = Routes.applicationGuildCommands(clientId, guildId);

  if (clearFirst) await rest.put(route, { body: [] });
  return rest.put(route, { body: payload() });
}

module.exports = { payload, newRest, currentApplicationId, deployGlobal, deployGuild };