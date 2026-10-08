require('dotenv').config();

const { db } = require('../lib/db');

const WIPABLE = ['verifications', 'verify_log', 'reminders', 'tickets', 'warnings', 'role_menus'];

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: npm run reset -- [options]

  (no options)          clear verifications only, so people can verify again
  --all                 clear ${WIPABLE.join(', ')}
  --reminders           clear reminders
  --tickets             clear tickets
  --warnings            clear warnings
  --role-menus          clear role menus (existing buttons stop working)
  --verify-log          clear the old verify event log
  --settings            also clear per-guild verification settings
                        (role names and prefixes revert to defaults)
  --yes                 skip the confirmation prompt`);
  process.exit(0);
}

let targets = WIPABLE;

if (!flags.has('--all')) {
  targets = ['verifications'];

  const extra = [
    ['--reminders', 'reminders'],
    ['--tickets', 'tickets'],
    ['--warnings', 'warnings'],
    ['--role-menus', 'role_menus'],
    ['--verify-log', 'verify_log'],
    ['--settings', 'settings'],
  ];

  for (const [flag, table] of extra) {
    if (flags.has(flag)) targets.push(table);
  }
}

const rows = (table) => db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;

const summary = targets.map((table) => `${table}: ${rows(table)}`);

console.log(`About to clear -> ${summary.join(', ')}`);

if (flags.has('--settings')) {
  console.log('WARNING: settings will be reset, so role prefixes go back to defaults.');
}

if (!flags.has('--yes')) {
  console.log('Re-run with --yes to confirm.');
  process.exit(1);
}

for (const table of targets) {
  const before = rows(table);
  db.prepare(`DELETE FROM ${table}`).run();
  db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);

  console.log(`cleared ${table} (${before} rows)`);
}

console.log('\nDatabase reset complete.');
process.exit(0);