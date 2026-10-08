const { Options } = require('discord.js');

const START_DELAY = 4_000;

function cacheIsComplete(guild) {
  const expected = guild.memberCount ?? null;
  return expected !== null && guild.members.cache.size >= expected;
}

async function warmGuild(guild, { timeout } = {}) {
  if (cacheIsComplete(guild)) return { guild: guild.name, skipped: true, cached: guild.members.cache.size };

  const before = guild.members.cache.size;

  const started = Date.now();

  try {
    const fetched = timeout
      ? await guild.members.fetch({ time: timeout })
      : await guild.members.fetch();

    return {
      guild: guild.name,
      skipped: false,
      cached: fetched.size,
      from: before,
      ms: Date.now() - started,
    };
  } catch (error) {
    return { guild: guild.name, skipped: false, cached: before, error: error.message };
  }
}

async function warmMemberCache(client, { delay = START_DELAY, timeout } = {}) {
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  console.log('Warming the member cache so commands do not have to wait on the gateway...');

  const results = [];

  for (const guild of client.guilds.cache.values()) {
    const result = await warmGuild(guild, { timeout });
    results.push(result);

    if (result.skipped) {
      console.log(`  ${guild.name}: cache already complete (${result.cached})`);
    } else if (result.error) {
      console.warn(`  ${guild.name}: cache warm failed (${result.error}); keeping ${result.cached}`);
    } else {
      console.log(`  ${guild.name}: cached ${result.cached} member(s) in ${result.ms}ms`);
    }
  }

  const failed = results.filter((result) => result.error).length;
  console.log(`Member cache warm finished (${results.length} guilds, ${failed} failed).`);

  return results;
}

module.exports = { warmMemberCache, warmGuild, cacheIsComplete, Options };