const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { PermissionsBitField } = require('discord.js');

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
const { getSettings, saveSettings, roleNameFor, parseSubmission } = require('../lib/verify');

const checks = [];
const record = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
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
  assert.strictEqual(roleNameFor('grade', '10', config), 'grade 10');
  assert.strictEqual(roleNameFor('team', '4', config), 'team 4');
  assert.strictEqual(
    roleNameFor('grade', '  10  ', { ...config, gradeRolePrefix: 'year' }),
    'year 10',
    'should tidy whitespace'
  );
});

record('verification submissions are validated', () => {
  const makeInteraction = (fields) => ({
    fields: { getTextInputValue: (id) => fields[id] },
  });

  const good = parseSubmission(
    makeInteraction({ full_name: 'Ada Lovelace', student_number: 'S12345', team_id: '', grade: '10' })
  );
  assert.deepStrictEqual(good.errors, [], 'valid submission rejected');
  assert.strictEqual(good.teamId, null, 'blank team should become null');

  const bad = parseSubmission(
    makeInteraction({ full_name: 'A', student_number: '!!', team_id: '', grade: '' })
  );
  assert.ok(bad.errors.length === 3, `expected 3 errors, got ${bad.errors.length}`);
});

record('verifications persist and are queryable', () => {
  const id = verifications.add({
    guildId: 'g7',
    userId: 'u9',
    fullName: 'Grace Hopper',
    studentNumber: 'S999',
    teamId: '4',
    grade: '12',
    nicknameSet: true,
    rolesGranted: ['verified', 'grade 12', 'team 4'],
  });

  assert.ok(id > 0, 'no row id returned');
  assert.strictEqual(verifications.count('g7'), 1, 'count wrong');
  assert.strictEqual(verifications.existsFor('g7', 'u9'), true, 'existsFor should be true');
  assert.strictEqual(verifications.existsFor('g7', 'nope'), false, 'existsFor should be false');

  const [row] = verifications.recent('g7', 5);
  assert.strictEqual(row.full_name, 'Grace Hopper', 'name not stored');
  assert.strictEqual(row.roles_granted, 'verified,grade 12,team 4', 'roles not stored');
});

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.ok ? '' : ` -> ${check.error}`}`);
}

console.log(`\n${checks.length - failed.length}/${checks.length} checks passed across ${commands.length} commands.`);

process.exit(failed.length === 0 ? 0 : 1);