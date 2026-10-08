const { getSettings, saveSettings, ensureRole } = require('./verify');
const { MAX_GRADE, findRoleByName, discoverGradeRoles, gradeSummary, nextRoleNameFor } = require('./grades');

const MEMBER_DELAY_MS = 400;
const ROLLOVER_MONTH = 8;
const ROLLOVER_DAY = 1;

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

function buildPlan(discovered, graduatedRole) {
  const plan = new Map();
  const skipped = [];

  for (const entry of discovered.values()) {
    for (const member of entry.role.members.values()) {
      if (graduatedRole && member.roles.cache.has(graduatedRole.id)) {
        skipped.push({ user: member.user.tag, reason: 'already graduated' });
        continue;
      }

      const existing = plan.get(member.id);

      if (existing && existing.grade >= entry.grade) continue;

      plan.set(member.id, { member, grade: entry.grade, from: entry.role });
    }
  }

  return { plan, skipped };
}

async function rolloverGuild(guild, { dryRun = false } = {}) {
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

  const targets = new Map();

  for (const entry of discovered.values()) {
    const name = nextRoleNameFor(entry, discovered, settings);
    targets.set(entry.grade, name);
  }

  if (dryRun) {
    const { plan } = buildPlan(discovered, graduatedRole);

    const preview = [...discovered.values()]
      .sort((a, b) => a.grade - b.grade)
      .map((entry) => `  "${entry.role.name}" (${entry.role.members.size}) -> "${targets.get(entry.grade)}"`);

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

  const { plan, skipped } = buildPlan(discovered, graduatedRole);

  const alreadyInTarget = [];

  for (const [memberId, entry] of plan) {
    const target = resolved.get(entry.grade);

    if (!target) continue;

    if (entry.from.id === target.id) {
      alreadyInTarget.push(entry.member.user.tag);
      plan.delete(memberId);
      continue;
    }

    entry.to = target;
  }

  let moved = 0;

  for (const entry of plan.values()) {
    try {
      await entry.member.roles.add(entry.to, 'Annual grade rollover');
      await entry.member.roles.remove(entry.from, 'Annual grade rollover');
      moved += 1;
    } catch (error) {
      console.error(`[${guild.name}] failed for ${entry.member.user.tag}:`, error.message);
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
  const results = [];

  for (const guild of client.guilds.cache.values()) {
    const settings = getSettings(guild.id);

    if (!options.force && !isDue(settings)) continue;

    try {
      const result = await rolloverGuild(guild, options);
      results.push({ guild: guild.name, ...result });
    } catch (error) {
      console.error(`[${guild.name}] rollover failed:`, error);
      results.push({ guild: guild.name, error: error.message });
    }
  }

  return results;
}

module.exports = {
  runRollover,
  rolloverGuild,
  isDue,
  mostRecentRollover,
  buildPlan,
};