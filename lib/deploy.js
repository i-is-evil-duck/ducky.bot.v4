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

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const GUILD_DELAY_MS = 1_200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function putWithRetry(rest, route, body, label) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await withTimeout(rest.put(route, { body }), TIMEOUT_MS, label);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      const wait = 1000 * attempt;
      console.warn(`  ${label} failed (${error.message}); retrying in ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function clearGlobal(rest, clientId) {
  return putWithRetry(rest, Routes.applicationCommands(clientId), [], '[global] clear');
}

async function deployGlobal(rest, clientId, { clearFirst = true } = {}) {
  if (clearFirst) await clearGlobal(rest, clientId);
  return putWithRetry(rest, Routes.applicationCommands(clientId), payload(), '[global] register');
}

async function deployGuild(rest, clientId, guildId, { clearFirst = false } = {}) {
  const route = Routes.applicationGuildCommands(clientId, guildId);

  if (clearFirst) {
    await putWithRetry(rest, route, [], `[guild ${guildId}] clear`);
  }

  return putWithRetry(rest, route, payload(), `[guild ${guildId}] register`);
}

async function deployAllGuilds(rest, clientId, guildIds) {
  const failures = [];

  for (const guildId of guildIds) {
    try {
      await deployGuild(rest, clientId, guildId);
      console.log(`[guild ${guildId}] registered ${payload().length} commands`);
    } catch (error) {
      failures.push({ guildId, error: error.message });
      console.warn(`[guild ${guildId}] FAILED: ${error.message}`);
    }

    await sleep(GUILD_DELAY_MS);
  }

  return failures;
}

async function clearGuild(rest, clientId, guildId) {
  return putWithRetry(
    rest,
    Routes.applicationGuildCommands(clientId, guildId),
    [],
    `[guild ${guildId}] clear`
  );
}

module.exports = {
  payload,
  newRest,
  currentApplicationId,
  deployGlobal,
  deployGuild,
  deployAllGuilds,
  clearGlobal,
  clearGuild,
};