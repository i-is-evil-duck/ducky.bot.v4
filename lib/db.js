const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ducky.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  message TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (status, due_at);
CREATE INDEX IF NOT EXISTS reminders_user_idx ON reminders (user_id, status);

CREATE TABLE IF NOT EXISTS verify_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_message_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS verify_log_guild_idx ON verify_log (guild_id, created_at);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  team_id TEXT,
  grade TEXT NOT NULL,
  nickname_set INTEGER NOT NULL DEFAULT 0,
  roles_granted TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS verifications_guild_idx ON verifications (guild_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS warnings_user_idx ON warnings (guild_id, user_id);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets (guild_id, user_id, status);

CREATE TABLE IF NOT EXISTS role_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  title TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS role_menus_guild_idx ON role_menus (guild_id);
`);

const now = () => Date.now();

const statements = {
  insertReminder: db.prepare(
    `INSERT INTO reminders (user_id, created_by, guild_id, channel_id, message, due_at, created_at)
     VALUES (@user_id, @created_by, @guild_id, @channel_id, @message, @due_at, @created_at)`
  ),
  dueReminders: db.prepare(`SELECT * FROM reminders WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC LIMIT ?`),
  completeReminder: db.prepare(`UPDATE reminders SET status = 'sent' WHERE id = ?`),
  failReminder: db.prepare(`UPDATE reminders SET status = 'failed' WHERE id = ?`),
  pendingRemindersForUser: db.prepare(
    `SELECT * FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY due_at ASC`
  ),
  cancelReminder: db.prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'`),
  getReminder: db.prepare(`SELECT * FROM reminders WHERE id = ?`),

  insertVerify: db.prepare(
    `INSERT INTO verify_log (guild_id, user_id, source_message_id, created_at)
     VALUES (@guild_id, @user_id, @source_message_id, @created_at)`
  ),
  recentVerifyLogEntries: db.prepare(
    `SELECT * FROM verify_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`
  ),

  insertWarning: db.prepare(
    `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
     VALUES (@guild_id, @user_id, @moderator_id, @reason, @created_at)`
  ),
  warningsForUser: db.prepare(
    `SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`
  ),
  countActiveWarnings: db.prepare(
    `SELECT COUNT(*) AS total FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1`
  ),
  clearWarnings: db.prepare(`UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ?`),

  openTicket: db.prepare(
    `INSERT INTO tickets (guild_id, channel_id, user_id, kind, subject, created_at)
     VALUES (@guild_id, @channel_id, @user_id, @kind, @subject, @created_at)`
  ),
  ticketByChannel: db.prepare(`SELECT * FROM tickets WHERE channel_id = ?`),
  openTicketForUser: db.prepare(
    `SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'`
  ),
  closeTicket: db.prepare(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`),

  insertRoleMenu: db.prepare(
    `INSERT INTO role_menus (guild_id, channel_id, message_id, title, roles_json, created_by, created_at)
     VALUES (@guild_id, @channel_id, @message_id, @title, @roles_json, @created_by, @created_at)`
  ),
  roleMenuByMessage: db.prepare(`SELECT * FROM role_menus WHERE message_id = ?`),
  roleMenusForGuild: db.prepare(`SELECT * FROM role_menus WHERE guild_id = ?`),
  deleteRoleMenu: db.prepare(`DELETE FROM role_menus WHERE id = ?`),

  insertVerification: db.prepare(
    `INSERT INTO verifications
      (guild_id, user_id, full_name, student_number, team_id, grade, nickname_set, roles_granted, created_at)
     VALUES
      (@guild_id, @user_id, @full_name, @student_number, @team_id, @grade, @nickname_set, @roles_granted, @created_at)`
  ),
  listVerifications: db.prepare(
    `SELECT * FROM verifications WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`
  ),
  countVerifications: db.prepare(
    `SELECT COUNT(*) AS total FROM verifications WHERE guild_id = ?`
  ),
  hasVerification: db.prepare(
    `SELECT id FROM verifications WHERE guild_id = ? AND user_id = ? LIMIT 1`
  ),

  getSettings: db.prepare(`SELECT data FROM settings WHERE guild_id = ?`),
  putSettings: db.prepare(
    `INSERT INTO settings (guild_id, data, updated_at) VALUES (@guild_id, @data, @updated_at)
     ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ),
};

const reminders = {
  add({ userId, createdBy, guildId, channelId, message, dueAt }) {
    const info = statements.insertReminder.run({
      user_id: userId,
      created_by: createdBy,
      guild_id: guildId ?? null,
      channel_id: channelId ?? null,
      message,
      due_at: dueAt,
      created_at: now(),
    });
    return info.lastInsertRowid;
  },
  due(limit = 25) {
    return statements.dueReminders.all(now(), limit);
  },
  markSent(id) {
    statements.completeReminder.run(id);
  },
  markFailed(id) {
    statements.failReminder.run(id);
  },
  pendingFor(userId) {
    return statements.pendingRemindersForUser.all(userId);
  },
  cancel(id, userId) {
    return statements.cancelReminder.run(id, userId).changes > 0;
  },
  get(id) {
    return statements.getReminder.get(id);
  },
};

const verifyLog = {
  add({ guildId, userId, sourceMessageId }) {
    statements.insertVerify.run({
      guild_id: guildId,
      user_id: userId,
      source_message_id: sourceMessageId ?? null,
      created_at: now(),
    });
  },
  recent(guildId, limit = 10) {
    return statements.recentVerifyLogEntries.all(guildId, limit);
  },
};

const warnings = {
  add({ guildId, userId, moderatorId, reason }) {
    const info = statements.insertWarning.run({
      guild_id: guildId,
      user_id: userId,
      moderator_id: moderatorId,
      reason,
      created_at: now(),
    });
    return info.lastInsertRowid;
  },
  forUser(guildId, userId) {
    return statements.warningsForUser.all(guildId, userId);
  },
  activeCount(guildId, userId) {
    return statements.countActiveWarnings.get(guildId, userId).total;
  },
  clear(guildId, userId) {
    statements.clearWarnings.run(guildId, userId);
  },
};

const tickets = {
  open({ guildId, channelId, userId, kind, subject }) {
    const info = statements.openTicket.run({
      guild_id: guildId,
      channel_id: channelId,
      user_id: userId,
      kind,
      subject: subject ?? null,
      created_at: now(),
    });
    return info.lastInsertRowid;
  },
  byChannel(channelId) {
    return statements.ticketByChannel.get(channelId);
  },
  openForUser(guildId, userId) {
    return statements.openTicketForUser.all(guildId, userId);
  },
  close(id) {
    statements.closeTicket.run(now(), id);
  },
};

const roleMenus = {
  create({ guildId, channelId, messageId, title, roles, createdBy }) {
    const info = statements.insertRoleMenu.run({
      guild_id: guildId,
      channel_id: channelId,
      message_id: messageId,
      title,
      roles_json: JSON.stringify(roles),
      created_by: createdBy,
      created_at: now(),
    });
    return info.lastInsertRowid;
  },
  byMessage(messageId) {
    const row = statements.roleMenuByMessage.get(messageId);
    if (!row) return null;
    return { ...row, roles: JSON.parse(row.roles_json) };
  },
  forGuild(guildId) {
    return statements.roleMenusForGuild.all(guildId).map((row) => ({
      ...row,
      roles: JSON.parse(row.roles_json),
    }));
  },
  remove(id) {
    return statements.deleteRoleMenu.run(id).changes > 0;
  },
};

const settings = {
  get(guildId) {
    const row = statements.getSettings.get(guildId);
    return row ? JSON.parse(row.data) : null;
  },
  save(guildId, data) {
    statements.putSettings.run({
      guild_id: guildId,
      data: JSON.stringify(data),
      updated_at: now(),
    });
    return data;
  },
};

const verifications = {
  add(record) {
    return statements.insertVerification.run({
      guild_id: record.guildId,
      user_id: record.userId,
      full_name: record.fullName,
      student_number: record.studentNumber,
      team_id: record.teamId ?? null,
      grade: record.grade,
      nickname_set: record.nicknameSet ? 1 : 0,
      roles_granted: (record.rolesGranted ?? []).join(','),
      created_at: now(),
    }).lastInsertRowid;
  },
  recent(guildId, limit = 10) {
    return statements.listVerifications.all(guildId, limit);
  },
  count(guildId) {
    return statements.countVerifications.get(guildId).total;
  },
  existsFor(guildId, userId) {
    return Boolean(statements.hasVerification.get(guildId, userId));
  },
};

module.exports = {
  db,
  reminders,
  verifyLog,
  verifications,
  warnings,
  tickets,
  roleMenus,
  settings,
  DATA_DIR,
};