const { EmbedBuilder } = require('discord.js');

const { getSettings, saveSettings, ensureRole } = require('./verify');
const { MAX_GRADE, findRoleByName, discoverGradeRoles, gradeSummary, nextRoleNameFor } = require('./grades');

const MEMBER_DELAY_MS = 400;
const ROLLOVER_MONTH = 8;
const ROLLOVER_DAY = 1;
const MAX_FIELDS = 25;
const MAX_FIELD_VALUE = 1020;
const MEMBER_PAGE = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mostRecentRollover(now = Date.now()) {
  const date = new Date(now);
  let year = date.getFullYear();

  let boundary = new Date(year, ROLLOVER_MONTH, ROLLOVER_DAY, 0, 0, 0, 0);

  if (now < boundary.getTime()) {
    year -= 1;
    boundary = new Date(year, ROLLOVER_MONTH, ROLLOVER_DAY, 0, 0, 0, 0);
  }

  return boundary.getTime();
}

function isDue(settings, now = Date.now()) {
  if (!settings?.configuredAt) return false;

  const boundary = mostRecentRollover(now);
  const lastRun = settings.lastRollover || settings.configuredAt;

  return now >= boundary && lastRun < boundary;
}

const MEMBER_FETCH_TIMEOUT = 8000;

async function fetchMembers(guild, { timeout = MEMBER_FETCH_TIMEOUT } = {}) {
  const cached = [...guild.members.cache.values()];
  const expected = guild.memberCount ?? null;

  if (expected !== null && cached.length >= expected) return cached;

  try {
    const fetched = await guild.members.fetch({ time: timeout });
    return [...fetched.values()];
  } catch (error) {
    console.warn(
      `[${guild.name}] member fetch gave up after ${timeout}ms (${error.message}); using ${cached.length} cached member(s), which may be incomplete`
    );
    return cached;
  }
}

function toRows(members) {
  return members.map((member) => ({
    user: {
      id: member.id,
      username: member.user?.username ?? member.user?.tag ?? member.id,
      tag: member.user?.tag ?? member.id,
    },
    roles: [...member.roles.cache.keys()],
  }));
}

function buildPlan(rows, discovered, graduatedRoleId) {
  const plan = new Map();
  const skipped = [];
  const byRoleId = new Map([...discovered.values()].map((entry) => [entry.role.id, entry.grade]));

  for (const row of rows) {
    const roles = row.roles ?? [];

    if (graduatedRoleId && roles.includes(graduatedRoleId)) {
      skipped.push({ user: row.user?.tag ?? row.user?.id, reason: 'already graduated' });
      continue;
    }

    let highest = null;
    const held = [];

    for (const roleId of roles) {
      const grade = byRoleId.get(roleId);

      if (grade === undefined) continue;

      held.push(roleId);

      if (highest === null || grade > highest.grade) highest = { grade, roleId };
    }

    if (highest === null) continue;

    const existing = plan.get(row.user.id);

    if (existing && existing.grade >= highest.grade) continue;

    plan.set(row.user.id, {
      userId: row.user.id,
      user: row.user,
      grade: highest.grade,
      fromRoleIds: held,
    });
  }

  return { plan, skipped };
}

function gradeCounts(rows, discovered) {
  const byRoleId = new Map([...discovered.values()].map((entry) => [entry.role.id, entry.grade]));
  const counts = new Map(discovered.keys().map((grade) => [grade, 0]));

  for (const row of rows) {
    let highest = null;

    for (const roleId of row.roles ?? []) {
      const grade = byRoleId.get(roleId);

      if (grade !== undefined && (highest === null || grade > highest)) highest = grade;
    }

    if (highest !== null) counts.set(highest, counts.get(highest) + 1);
  }

  return counts;
}

async function rolloverGuild(client, guild, { dryRun = false } = {}) {
  const settings = getSettings(guild.id);

  if (!settings.giveGradeRole) {
    return { skipped: true, reason: 'grade roles are disabled', moved: 0 };
  }

  const discovered = discoverGradeRoles(guild);

  if (discovered.size === 0) {
    console.log(`[${guild.name}] no grade roles found - nothing to roll over`);
    if (!dryRun) saveSettings(guild.id, { lastRollover: mostRecentRollover() });
    return { skipped: true, reason: 'no grade roles found', moved: 0 };
  }

  console.log(`[${guild.name}] found grade roles: ${gradeSummary(discovered)}`);

  const graduatedName = settings.graduatedRoleName || 'The Graduated';
  let graduatedRole = findRoleByName(guild, graduatedName);

  const members = await fetchMembers(guild);
  const rows = toRows(members);
  const counts = gradeCounts(rows, discovered);
  const targets = new Map();

  for (const entry of discovered.values()) {
    const name = nextRoleNameFor(entry, discovered, settings);
    targets.set(entry.grade, name);
  }

  if (dryRun) {
    const { plan } = buildPlan(rows, discovered, graduatedRole?.id);

    const preview = [...discovered.values()]
      .sort((a, b) => a.grade - b.grade)
      .map(
        (entry) =>
          `  "${entry.role.name}" (${counts.get(entry.grade) ?? 0}) -> "${targets.get(entry.grade)}"`
      );

    console.log(`[${guild.name}] dry run, ${plan.size} member(s) would move:\n${preview.join('\n')}`);

    return {
      skipped: false,
      dryRun: true,
      moved: plan.size,
      graduatedRoleName: graduatedName,
      graduatedExists: Boolean(graduatedRole),
      targets: Object.fromEntries(targets),
    };
  }

  const { role: ensuredGraduated, blocked: graduatedBlocked } = await ensureRole(
    guild,
    graduatedName,
    'Annual grade rollover'
  );

  if (graduatedBlocked) {
    console.error(`[${guild.name}] could not ensure "${graduatedName}": ${graduatedBlocked}`);
    return { skipped: false, moved: 0, error: graduatedBlocked };
  }

  graduatedRole = ensuredGraduated ?? graduatedRole;

  const resolved = new Map();

  for (const [grade, name] of targets) {
    if (name.toLowerCase() === graduatedName.toLowerCase()) {
      resolved.set(grade, graduatedRole);
      continue;
    }

    const { role, blocked } = await ensureRole(guild, name, 'Annual grade rollover');

    if (blocked) {
      console.error(`[${guild.name}] could not ensure "${name}": ${blocked}`);
      continue;
    }

    resolved.set(grade, role ?? findRoleByName(guild, name));
  }

  const { plan, skipped } = buildPlan(rows, discovered, graduatedRole?.id);

  const alreadyInTarget = [];

  for (const [memberId, entry] of plan) {
    const target = resolved.get(entry.grade);

    if (!target) {
      plan.delete(memberId);
      continue;
    }

    if (entry.fromRoleIds.length === 1 && entry.fromRoleIds[0] === target.id) {
      alreadyInTarget.push(entry.user?.tag ?? entry.userId);
      plan.delete(memberId);
      continue;
    }

    entry.to = target;
  }

  let moved = 0;

  for (const entry of plan.values()) {
    const label = entry.user?.username ?? entry.userId;

    try {
      const member = await guild.members.fetch(entry.userId);

      await member.roles.add(entry.to, 'Annual grade rollover');

      for (const roleId of entry.fromRoleIds) {
        await member.roles.remove(roleId, 'Annual grade rollover');
      }

      moved += 1;
    } catch (error) {
      console.error(`[${guild.name}] failed for ${label}:`, error.message);
    }

    await sleep(MEMBER_DELAY_MS);
  }

  saveSettings(guild.id, { lastRollover: mostRecentRollover() });

  console.log(
    `[${guild.name}] rollover complete: ${moved} moved, ${skipped.length} skipped, ${alreadyInTarget.length} already correct`
  );

  return { skipped: false, moved, skippedCount: skipped.length, targets: Object.fromEntries(targets) };
}

async function runRollover(client, options = {}) {
  const { force = false, dryRun = false, guildId = null } = options;
  const results = [];

  const guilds = guildId
    ? [client.guilds.cache.get(guildId)].filter(Boolean)
    : [...client.guilds.cache.values()];

  if (guildId && guilds.length === 0) {
    console.warn(`Rollover skipped: guild ${guildId} is not in the cache`);
    return results;
  }

  for (const guild of guilds) {
    const settings = getSettings(guild.id);

    if (!force && !isDue(settings)) continue;

    try {
      const result = await rolloverGuild(client, guild, options);
      results.push({ guild: guild.name, guildId: guild.id, ...result });
    } catch (error) {
      console.error(`[${guild.name}] rollover failed:`, error);
      results.push({ guild: guild.name, guildId: guild.id, error: error.message });
    }
  }

  return results;
}

function describeResult(result, dryRun) {
  const lines = [];

  if (result.error) {
    lines.push(`Error: ${result.error}`);
  } else if (result.skipped) {
    lines.push(`Skipped: ${result.reason}`);
  } else if (result.dryRun || dryRun) {
    lines.push(`**${result.moved ?? 0}** member(s) would move:`);

    for (const [from, to] of Object.entries(result.targets ?? {})) {
      lines.push(`\`${from}\` -> \`${to}\``);
    }

    if (result.graduatedRoleName) {
      lines.push(
        `Graduated role: \`${result.graduatedRoleName}\` (${result.graduatedExists ? 'already exists' : 'will be created'})`
      );
    }
  } else {
    lines.push(`**${result.moved ?? 0}** member(s) advanced`);

    if (result.skippedCount) lines.push(`${result.skippedCount} skipped`);
  }

  return lines.join('\n').slice(0, MAX_FIELD_VALUE);
}

function describeRollover(results, { dryRun = false } = {}) {
  const fields = results.map((result) => ({
    name: result.guild?.slice(0, 256) ?? 'Unknown',
    value: describeResult(result, dryRun),
  }));

  const chunks = [];

  for (let index = 0; index < Math.max(fields.length, 1); index += MAX_FIELDS) {
    chunks.push(fields.slice(index, index + MAX_FIELDS));
  }

  return chunks.map((chunk, index) => {
    const embed = new EmbedBuilder()
      .setColor(dryRun ? '#0099ff' : '#00FF00')
      .setTitle(
        `${dryRun ? 'Rollover preview' : 'Rollover applied'}${chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''}`
      )
      .setTimestamp();

    if (chunk.length > 0) embed.addFields(chunk);

    return embed;
  });
}

module.exports = {
  runRollover,
  rolloverGuild,
  isDue,
  mostRecentRollover,
  buildPlan,
  gradeCounts,
  fetchMembers,
  MEMBER_FETCH_TIMEOUT,
  toRows,
  describeRollover,
  describeResult,
};