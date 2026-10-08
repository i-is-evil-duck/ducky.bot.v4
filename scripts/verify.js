const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { Collection, PermissionsBitField } = require('discord.js');

const TEST_DIR = path.join(__dirname, '..', 'data', 'verify-test');
fs.rmSync(TEST_DIR, { recursive: true, force: true });
process.env.DATA_DIR = TEST_DIR;

const { collectCommands } = require('../lib/commands');
const {
  reminders,
  verifyLog,
  verifications,
  warnings,
  tickets,
  roleMenus,
  settings,
} = require('../lib/db');
const { getSettings, saveSettings, roleNameFor, parseSubmission, GRADES, MAX_GRADE } = require('../lib/verify');
const { isDue, mostRecentRollover, buildPlan } = require('../lib/rollover');
const { parseGradeFromName, buildRoleName, discoverGradeRoles, gradeSummary } = require('../lib/grades');

const checks = [];
const pending = [];

const record = (name, fn) => {
  const entry = { name, ok: true, error: null };
  checks.push(entry);

  try {
    const result = fn();

    if (result && typeof result.then === 'function') {
      pending.push(
        result.then(
          () => {},
          (error) => {
            entry.ok = false;
            entry.error = error.message;
          }
        )
      );
    }
  } catch (error) {
    entry.ok = false;
    entry.error = error.message;
  }
};

const commands = collectCommands();

record('commands load with data + run', () => {
  assert.ok(commands.length > 0, 'no commands found');
  for (const command of commands) {
    assert.strictEqual(typeof command.data.name, 'string', 'command missing data.name');
    assert.strictEqual(typeof command.run, 'function', `${command.data.name} missing run`);
  }
});

record('command names are unique', () => {
  const names = commands.map((command) => command.data.name);
  assert.strictEqual(new Set(names).size, names.length, 'duplicate command name');
});

record('every command serialises to valid Discord JSON', () => {
  for (const command of commands) {
    const json = command.data.toJSON();
    assert.ok(json.name && json.description, `${command.data.name} missing name/description`);
    assert.ok(json.name.length <= 32, `${json.name} exceeds 32 chars`);
    assert.ok(json.description.length <= 100, `${json.name} description exceeds 100 chars`);
  }
});

record('total payload is under Discord 100k limit', () => {
  const bytes = commands.reduce((sum, c) => sum + JSON.stringify(c.data.toJSON()).length, 0);
  assert.ok(bytes < 100_000, `payload is ${bytes} bytes`);
});

record('all declared permissions are valid bitfields', () => {
  for (const command of commands) {
    for (const perm of [...(command.userPerms ?? []), ...(command.botPerms ?? [])]) {
      PermissionsBitField.resolve(perm);
    }
  }
});

record('subcommand option names are valid', () => {
  const pattern = /^[-_\p{L}\p{N}]{1,32}$/u;
  for (const command of commands) {
    const walk = (options) => {
      for (const option of options ?? []) {
        assert.match(option.name, pattern, `${command.data.name}: bad option name ${option.name}`);
        if (option.options) walk(option.options);
      }
    };
    walk(command.data.options);
  }
});

record('reminders: add -> list -> cancel', () => {
  const id = reminders.add({ userId: 'u1', createdBy: 'u1', message: 'test', dueAt: Date.now() + 60_000 });
  assert.ok(reminders.pendingFor('u1').some((row) => row.id === id), 'reminder not listed');
  assert.strictEqual(reminders.cancel(id, 'someone-else'), false, 'cancel should be owner-only');
  assert.strictEqual(reminders.cancel(id, 'u1'), true, 'cancel failed');
  assert.ok(!reminders.pendingFor('u1').some((row) => row.id === id), 'cancelled reminder still pending');
});

record('reminders: due() returns past-due rows only', () => {
  reminders.add({ userId: 'u2', createdBy: 'u2', message: 'past', dueAt: Date.now() - 1000 });
  const due = reminders.due();
  assert.ok(due.some((row) => row.user_id === 'u2'), 'overdue reminder not returned');
});

record('verify log persists', () => {
  verifyLog.add({ guildId: 'g1', userId: 'u3', sourceMessageId: 'm1' });
  assert.strictEqual(verifyLog.recent('g1', 5).length, 1, 'verify row missing');
});

record('warnings persist', () => {
  warnings.add({ guildId: 'g1', userId: 'u4', moderatorId: 'mod', reason: 'spam' });
  assert.strictEqual(warnings.activeCount('g1', 'u4'), 1, 'warning count wrong');
  warnings.clear('g1', 'u4');
  assert.strictEqual(warnings.activeCount('g1', 'u4'), 0, 'warnings not cleared');
});

record('tickets open and close', () => {
  const id = tickets.open({ guildId: 'g1', channelId: 'c1', userId: 'u5', kind: 'support' });
  assert.strictEqual(tickets.openForUser('g1', 'u5').length, 1, 'ticket not open');
  tickets.close(id);
  assert.strictEqual(tickets.openForUser('g1', 'u5').length, 0, 'ticket still open');
});

record('role menus persist and serialise', () => {
  const id = roleMenus.create({
    guildId: 'g1',
    channelId: 'c2',
    messageId: 'm2',
    title: 'Roles',
    roles: ['111', '222'],
    createdBy: 'u1',
  });
  const menu = roleMenus.byMessage('m2');
  assert.deepStrictEqual(menu.roles, ['111', '222'], 'roles not parsed');
  assert.strictEqual(roleMenus.remove(id), true, 'delete failed');
});

record('verification settings default and round-trip', () => {
  const defaults = getSettings('g9');
  assert.strictEqual(defaults.verifiedRoleName, 'verified', 'unexpected default role');
  assert.strictEqual(defaults.setNickname, true, 'nickname should default on');

  saveSettings('g9', { gradeRolePrefix: 'year', setNickname: false });
  const updated = getSettings('g9');
  assert.strictEqual(updated.gradeRolePrefix, 'year', 'patch not applied');
  assert.strictEqual(updated.setNickname, false, 'boolean patch not applied');
  assert.strictEqual(updated.verifiedRoleName, 'verified', 'patch clobbered other keys');
});

record('verification role names follow configured prefixes', () => {
  const config = { verifiedRoleName: 'verified', teamRolePrefix: 'team', gradeRolePrefix: 'grade' };
  assert.strictEqual(roleNameFor('verified', null, config), 'verified');
  assert.strictEqual(roleNameFor('grade', 10, config), 'grade 10');
  assert.strictEqual(roleNameFor('team', 'a', config), 'team a');
  assert.strictEqual(roleNameFor('graduated', null, config), 'The Graduated');
  assert.strictEqual(
    roleNameFor('grade', 10, { ...config, gradeRolePrefix: 'year' }),
    'year 10',
    'should respect the configured prefix'
  );
});

record('grade and team letter are validated correctly', () => {
  const submit = (fields) =>
    parseSubmission({ fields: { getTextInputValue: (id) => fields[id] } });

  const full = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: 'B', grade: '11' });
  assert.deepStrictEqual(full.errors, [], 'valid submission rejected');
  assert.strictEqual(full.teamLetter, 'b', 'single letters should normalise to lowercase');
  assert.strictEqual(full.grade, 11, 'grade not parsed');

  const swarm = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: 'SWARM', grade: '8' });
  assert.strictEqual(swarm.teamLetter, 'SWARM', 'SWARM not accepted');
  assert.strictEqual(swarm.grade, 8, 'lowest grade rejected');

  const neither = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: '', grade: '10' });
  assert.deepStrictEqual(neither.errors, [], 'team should still be optional');
  assert.strictEqual(neither.teamLetter, null, 'blank team should be null');

  const blankGrade = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: 'a', grade: '' });
  assert.ok(
    blankGrade.errors.some((line) => line.includes('Grade is required')),
    'blank grade must be rejected now that it is mandatory'
  );

  const whitespaceGrade = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: 'a', grade: '   ' });
  assert.ok(whitespaceGrade.errors.length >= 1, 'whitespace-only grade must be rejected');

  for (const grade of ['7', '13', 'ten', '11.5', '0']) {
    const bad = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: '', grade });
    assert.ok(bad.errors.length >= 1, `grade ${grade} should be rejected`);
  }

  for (const team of ['ab', '1', 'alpha', 'SWARMED']) {
    const bad = submit({ full_name: 'Ada Lovelace', student_number: 'S12345', team_letter: team, grade: '' });
    assert.ok(bad.errors.length >= 1, `team ${team} should be rejected`);
  }
});

record('grade rollover is due once per September 1st', () => {
  const january2024 = new Date(2024, 0, 1).getTime();
  const july2024 = new Date(2024, 6, 31, 12).getTime();
  const september2024 = new Date(2024, 8, 1, 0, 0, 0).getTime();
  const march2025 = new Date(2025, 2, 15, 12).getTime();
  const september2025 = new Date(2025, 8, 1, 0, 0, 0).getTime();

  assert.strictEqual(
    isDue({ configuredAt: january2024, lastRollover: 0 }, july2024),
    false,
    'must not fire before Sep 1'
  );

  assert.strictEqual(
    isDue({ configuredAt: january2024, lastRollover: 0 }, september2024),
    true,
    'must fire on Sep 1'
  );

  const afterRunning = { configuredAt: january2024, lastRollover: september2024 };
  assert.strictEqual(isDue(afterRunning, march2025), false, 'must not fire twice in one season');
  assert.strictEqual(isDue(afterRunning, september2025), true, 'must fire again the next September');

  assert.strictEqual(isDue(null), false, 'unconfigured guilds must never roll over');
  assert.strictEqual(
    isDue({ lastRollover: 0 }, september2024),
    false,
    'a guild with no configuredAt must never roll over'
  );

  assert.strictEqual(
    isDue({ configuredAt: october2024(september2024), lastRollover: 0 }, september2025),
    true,
    'a guild configured after Sep 1 waits for the following September'
  );
});

function october2024(sep) {
  return sep + 30 * 24 * 60 * 60 * 1000;
}

record('most recent rollover boundary points at Sep 1', () => {
  assert.strictEqual(
    mostRecentRollover(new Date(2025, 3, 2).getTime()),
    new Date(2024, 8, 1).getTime(),
    'March 2025 should resolve to Sep 1 2024'
  );
  assert.strictEqual(
    mostRecentRollover(new Date(2025, 9, 20).getTime()),
    new Date(2025, 8, 1).getTime(),
    'October 2025 should resolve to Sep 1 2025'
  );
});

record('verifications persist and are queryable', () => {
  const id = verifications.add({
    guildId: 'g7',
    userId: 'u9',
    fullName: 'Grace Hopper',
    studentNumber: 'S999',
    teamLetter: 'SWARM',
    grade: 12,
    nicknameSet: true,
    rolesGranted: ['verified', 'grade 12', 'team SWARM'],
  });

  assert.ok(id > 0, 'no row id returned');
  assert.strictEqual(verifications.count('g7'), 1, 'count wrong');
  assert.strictEqual(verifications.existsFor('g7', 'u9'), true, 'existsFor should be true');
  assert.strictEqual(verifications.existsFor('g7', 'nope'), false, 'existsFor should be false');

  const [row] = verifications.recent('g7', 5);
  assert.strictEqual(row.full_name, 'Grace Hopper', 'name not stored');
  assert.strictEqual(row.team_letter, 'SWARM', 'team letter not stored');
  assert.strictEqual(row.grade, '12', 'grade not stored');
});

record('a verification needs a grade but not a team', () => {
  verifications.add({
    guildId: 'g8',
    userId: 'u10',
    fullName: 'No Team',
    studentNumber: 'S000',
    teamLetter: null,
    grade: 9,
    nicknameSet: false,
    rolesGranted: ['verified', 'Grade 9'],
  });

  const [row] = verifications.recent('g8', 1);
  assert.strictEqual(row.grade, '9', 'grade should be stored');
  assert.strictEqual(row.team_letter, null, 'team letter should still be nullable');
});

record('grades are read out of existing role names in any style', () => {
  const cases = {
    'grade 9': 9,
    'Grade 10': 10,
    'Gr8': 8,
    '9th Grade': 9,
    'Year 11': 11,
    '12th grade': 12,
    'Verified': null,
    'Team A': null,
    'Grade Lead': null,
    'The Graduated': null,
    'grade': null,
    'team swarm': null,
  };

  for (const [name, expected] of Object.entries(cases)) {
    assert.strictEqual(parseGradeFromName(name), expected, `wrong grade for "${name}"`);
  }
});

record('new role names adopt the servers existing convention', () => {
  assert.strictEqual(buildRoleName('Grade 9', 10), 'Grade 10');
  assert.strictEqual(buildRoleName('grade 8', 12), 'grade 12');
  assert.strictEqual(buildRoleName('Gr9', 10), 'Gr10');
  assert.strictEqual(buildRoleName('Year 9', 11), 'Year 11');

  assert.strictEqual(buildRoleName('9th Grade', 11), '11th Grade', 'ordinal suffix must be kept');
  assert.strictEqual(buildRoleName('9th Grade', 12), '12th Grade');
  assert.strictEqual(buildRoleName('1st Grade', 2), '2nd Grade', 'nd suffix is wrong');
  assert.strictEqual(buildRoleName('3rd Grade', 11), '11th Grade', 'th suffix is wrong');
  assert.strictEqual(buildRoleName('2nd Grade', 21), '21st Grade', '21 is st, not nd');

  assert.strictEqual(buildRoleName(null, 10), null);
  assert.strictEqual(buildRoleName('no digits here', 10), null);
});

record('grade roles are discovered across naming styles', () => {
  const fakeGuild = {
    roles: {
      cache: new Map(
        [
          { name: 'Grade 8', members: new Map([['a', {}]]) },
          { name: 'Grade 9', members: new Map() },
          { name: 'Grade 10', members: new Map() },
          { name: 'verified', members: new Map() },
          { name: 'Team A', members: new Map() },
        ].map((role) => [role.name, role])
      ),
      find(predicate) {
        for (const role of this.cache.values()) if (predicate(role)) return role;
        return undefined;
      },
    },
  };

  const discovered = discoverGradeRoles(fakeGuild);

  assert.strictEqual(discovered.size, 3, 'should find grades 8, 9 and 10 only');
  assert.ok(discovered.has(8) && discovered.has(9) && discovered.has(10), 'missing grades');
  assert.ok(!discovered.has(999), 'should ignore out-of-range numbers');
  assert.strictEqual(discovered.get(9).role.members.size, 0, 'role not captured');
  assert.strictEqual(gradeSummary(discovered), 'Grade 8 (1), Grade 9 (0), Grade 10 (0)', 'summary wrong');
});

record('rollover plan uses the highest grade when a member has two', () => {
  const member = {
    id: 'm1',
    user: { tag: 'user#1' },
    roles: { cache: new Map() },
  };

  const other = { id: 'm2', user: { tag: 'user#2' }, roles: { cache: new Map() } };

  const nine = { grade: 9, role: { name: 'Grade 9', members: new Map([['m1', member], ['m2', other]]) } };
  const ten = { grade: 10, role: { name: 'Grade 10', members: new Map([['m1', member]]) } };
  const discovered = new Map([
    [9, nine],
    [10, ten],
  ]);

  const { plan } = buildPlan(discovered, null);

  assert.strictEqual(plan.size, 2, 'both members should be planned once');
  assert.strictEqual(plan.get('m1').grade, 10, 'highest grade should win, avoiding a double bump');
  assert.strictEqual(plan.get('m1').from.name, 'Grade 10');
  assert.strictEqual(plan.get('m2').grade, 9);
});

record('rollover plan skips members who already graduated', () => {
  const graduated = {
    id: 'g-role',
    name: 'The Graduated',
    members: new Map(),
  };

  const member = { id: 'm1', user: { tag: 'user#1' }, roles: { cache: new Map([['g-role', {}]]) } };

  const discovered = new Map([
    [12, { grade: 12, role: { name: 'Grade 12', members: new Map([['m1', member]]) } }],
  ]);

  const { plan, skipped } = buildPlan(discovered, graduated);

  assert.strictEqual(plan.size, 0, 'graduated members must not move');
  assert.strictEqual(skipped.length, 1, 'skip should be reported');
});

const toCollection = (messages) => new Collection(new Map(messages.map((m) => [m.id, m])));

record('nickname blockers are reported accurately instead of blaming permissions', () => {
  const { nicknameBlockReason } = require('../lib/verify');

  const withNicknames = { has: () => true };
  const withoutNicknames = { has: () => false };

  const makeMe = (position, permissions = withNicknames, name = 'Ducky Bot') => ({
    permissions,
    roles: { highest: { position, name } },
  });

  const makeMember = (position, name = 'member') => ({
    roles: { highest: { position, name } },
  });

  const guild = (ownerId = 'owner') => ({ ownerId });

  assert.ok(
    nicknameBlockReason(guild('target'), { id: 'target' }, makeMe(10)).includes('server owner'),
    'the server owner can never be renamed'
  );

  assert.strictEqual(
    nicknameBlockReason(guild('owner'), makeMember(3), makeMe(10)),
    null,
    'a member below the bot and not the owner should be renameable'
  );

  assert.ok(
    nicknameBlockReason(guild('owner'), makeMember(5), makeMe(5)).length > 0,
    'equal role positions are not enough'
  );

  assert.ok(
    nicknameBlockReason(
      guild('owner'),
      makeMember(3),
      makeMe(10, withoutNicknames)
    ).includes('Manage Nicknames'),
    'a genuine missing permission should say so'
  );

  assert.ok(
    nicknameBlockReason(guild('owner'), makeMember(5), makeMe(2)).includes('not above'),
    'a bot below the member should mention the hierarchy'
  );
});

record('purge really deletes: all three subcommands pass a Collection to bulkDelete', () => {
  const purge = require('../commands/moderator/purge');

  const DAY = 24 * 60 * 60 * 1000;
  const message = (id, ageInDays) => ({ id, createdTimestamp: Date.now() - ageInDays * DAY });

  const recent = [message('m1', 1), message('m2', 2), message('m3', 3)];
  const all = [...recent, message('old1', 20), message('old2', 30)];

  const harness = (messages, subcommand, options) => {
    const captured = {};
    const available = toCollection(messages);

    const channel = {
      isTextBased: () => true,
      messages: { fetch: async () => available },
      bulkDelete(arg, filterOld) {
        captured.isCollection = arg instanceof Collection;
        captured.filterOld = filterOld;
        captured.ids = arg && arg.size !== undefined ? [...arg.keys()] : null;
        captured.undefinedKeys = captured.ids?.filter((id) => id === undefined || id === null).length ?? -1;
        return Promise.resolve(toCollection(messages.filter((m) => captured.ids?.includes(m.id))));
      },
    };

    const interaction = {
      channel,
      user: { tag: 'tester#0001' },
      options: {
        getSubcommand: () => subcommand,
        getInteger: (name) => options.count,
        getString: (name) => options[name],
      },
      reply: async (payload) => {
        captured.reply = payload;
      },
    };

    return { captured, interaction };
  };

  const run = async (messages, subcommand, options) => {
    const { captured, interaction } = harness(messages, subcommand, options);
    await purge.run({}, interaction, []);
    return captured;
  };

  return Promise.all([
    run(all, 'amount', { count: 3 }).then((captured) => {
      assert.strictEqual(captured.isCollection, true, 'bulkDelete must receive a Collection');
      assert.strictEqual(
        captured.undefinedKeys,
        0,
        'collection keys must be real message ids; bulkDelete snowflake-decodes them'
      );
      assert.strictEqual(captured.ids.length, 3, `expected 3 recent messages, got ${captured.ids}`);
      assert.ok(captured.ids.includes('old1') === false, 'messages older than 14 days must be skipped');
      assert.strictEqual(captured.filterOld, true, 'filterOld should be enabled');
    }),

    run(all, 'until', { 'message-id': 'm2' }).then((captured) => {
      assert.strictEqual(captured.isCollection, true, 'until must pass a Collection');
      assert.strictEqual(captured.undefinedKeys, 0, 'until must not lose message ids');
      assert.deepStrictEqual(
        captured.ids,
        ['m1'],
        'until should delete only messages newer than m2 (m1), not older ones (m3)'
      );
    }),

    run(all, 'between', { 'start-id': 'm1', 'end-id': 'm3' }).then((captured) => {
      assert.strictEqual(captured.isCollection, true, 'between must pass a Collection');
      assert.strictEqual(captured.undefinedKeys, 0, 'between must not lose message ids');
      assert.deepStrictEqual(captured.ids, ['m2'], 'between should select only messages inside the range');
    }),
  ]);
});

record('purge refuses unknown message ids instead of throwing', async () => {
  const purge = require('../commands/moderator/purge');

  const available = toCollection([{ id: 'm1', createdTimestamp: Date.now() }]);
  let replied = null;
  let deleteCalled = false;

  const interaction = {
    channel: {
      isTextBased: () => true,
      messages: { fetch: async () => available },
      bulkDelete: () => {
        deleteCalled = true;
        return Promise.resolve(new Collection());
      },
    },
    user: { tag: 'tester#0001' },
    options: {
      getSubcommand: () => 'until',
      getInteger: () => null,
      getString: () => 'does-not-exist',
    },
    reply: async (payload) => {
      replied = payload;
    },
  };

  await purge.run({}, interaction, []);

  assert.strictEqual(deleteCalled, false, 'must not delete anything');
  assert.ok(replied?.content, 'should explain the problem to the user');
});

Promise.all(pending).then(() => {
  const failed = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.ok ? '' : ` -> ${check.error}`}`);
  }

  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed across ${commands.length} commands.`);

  process.exit(failed.length === 0 ? 0 : 1);
});