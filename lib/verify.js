const { PermissionsBitField } = require('discord.js');

const { settings, verifications } = require('./db');

const DEFAULT_SETTINGS = {
  verifyChannelId: null,
  verifiedRoleName: 'verified',
  teamRolePrefix: 'team',
  gradeRolePrefix: 'grade',
  giveTeamRole: true,
  giveGradeRole: true,
  setNickname: true,
  logSubmissions: true,
  instructions: null,
};

const NICKNAME_MAX = 32;
const ROLE_NAME_MAX = 100;

function getSettings(guildId) {
  return { ...DEFAULT_SETTINGS, ...(settings.get(guildId) ?? {}) };
}

function saveSettings(guildId, patch) {
  const merged = { ...getSettings(guildId), ...patch };
  return settings.save(guildId, merged);
}

const tidy = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

function roleNameFor(kind, value, config) {
  const clean = tidy(value);

  if (kind === 'verified') return tidy(config.verifiedRoleName) || 'verified';
  if (kind === 'grade') return `${tidy(config.gradeRolePrefix) || 'grade'} ${clean}`.slice(0, ROLE_NAME_MAX);
  if (kind === 'team') return `${tidy(config.teamRolePrefix) || 'team'} ${clean}`.slice(0, ROLE_NAME_MAX);

  return null;
}

async function ensureRole(guild, name, reason) {
  const existing = guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    if (!guild.members.me?.roles.highest || existing.position < guild.members.me.roles.highest.position) {
      return { role: existing, created: false };
    }

    return { role: null, created: false, blocked: 'above-my-highest-role' };
  }

  try {
    const created = await guild.roles.create({ name, reason });
    return { role: created, created: true };
  } catch (error) {
    console.error(`Could not create role ${name}:`, error.message);
    return { role: null, created: false, blocked: error.message };
  }
}

function parseSubmission(interaction) {
  const get = (id) => tidy(interaction.fields.getTextInputValue(id));

  const fullName = get('full_name');
  const studentNumber = get('student_number');
  const teamId = get('team_id');
  const grade = get('grade');

  const errors = [];

  if (fullName.length < 2 || fullName.length > NICKNAME_MAX) {
    errors.push(`Name must be 2-${NICKNAME_MAX} characters.`);
  }

  if (!/^[A-Za-z0-9-]{3,20}$/.test(studentNumber)) {
    errors.push('Student number must be 3-20 letters, numbers or dashes.');
  }

  if (!/^[A-Za-z0-9-]{1,10}$/.test(grade)) {
    errors.push('Grade must be 1-10 characters (letters, numbers or dashes).');
  }

  if (teamId && !/^[A-Za-z0-9-]{1,10}$/.test(teamId)) {
    errors.push('Team must be 1-10 characters (letters, numbers or dashes).');
  }

  return {
    fullName,
    studentNumber,
    teamId: teamId || null,
    grade,
    errors,
  };
}

async function applyVerification(client, interaction) {
  const guild = interaction.guild;
  const config = getSettings(guild.id);
  const member = interaction.member;
  const submission = parseSubmission(interaction);

  if (submission.errors.length > 0) {
    return { ok: false, errors: submission.errors };
  }

  if (verifications.existsFor(guild.id, member.id)) {
    return { ok: false, errors: ['You have already completed verification in this server.'] };
  }

  const wanted = [{ kind: 'verified', value: null }];

  if (config.giveGradeRole) wanted.push({ kind: 'grade', value: submission.grade });
  if (config.giveTeamRole && submission.teamId) wanted.push({ kind: 'team', value: submission.teamId });

  const granted = [];
  const problems = [];

  for (const want of wanted) {
    const name = roleNameFor(want.kind, want.value, config);

    if (!name) continue;

    const { role, created, blocked } = await ensureRole(guild, name, `Verification for ${submission.fullName}`);

    if (blocked) {
      problems.push(`${name} (${blocked})`);
      continue;
    }

    granted.push({ role, created });
  }

  const grantable = granted.filter((entry) => entry.role);
  const aboveMe = grantable.filter((entry) => entry.role.position >= (guild.members.me?.roles.highest.position ?? 0));

  if (grantable.length === 0) {
    return {
      ok: false,
      errors: ['No roles could be granted. Check that the bot outranks the configured roles.'],
    };
  }

  await member.roles.add(grantable.filter((entry) => !aboveMe.includes(entry)).map((entry) => entry.role));

  let nicknameSet = false;

  if (config.setNickname && submission.fullName.length <= NICKNAME_MAX) {
    nicknameSet = await member
      .setNickname(submission.fullName)
      .then(() => true)
      .catch((error) => {
        console.error('Nickname change failed:', error.message);
        return false;
      });
  }

  const roleNames = grantable.filter((entry) => !aboveMe.includes(entry)).map((entry) => entry.role.name);

  verifications.add({
    guildId: guild.id,
    userId: member.id,
    fullName: submission.fullName,
    studentNumber: submission.studentNumber,
    teamId: submission.teamId,
    grade: submission.grade,
    nicknameSet,
    rolesGranted: roleNames,
  });

  const failures = [
    ...problems.map((name) => `Role ${name} could not be created.`),
    ...aboveMe.map((entry) => `${entry.role.name} is above my highest role, so it was skipped.`),
  ];

  if (config.logSubmissions && guild.channels.cache.get(config.verifyChannelId)?.isTextBased()) {
    const { EmbedBuilder } = require('discord.js');

    await guild.channels.cache
      .get(config.verifyChannelId)
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('New verification')
            .setFields(
              { name: 'Member', value: `<@${member.id}>`, inline: true },
              { name: 'Name', value: submission.fullName, inline: true },
              { name: 'Student number', value: submission.studentNumber, inline: true },
              { name: 'Grade', value: submission.grade, inline: true },
              { name: 'Team', value: submission.teamId || 'None', inline: true },
              { name: 'Nickname set', value: nicknameSet ? 'Yes' : 'No', inline: true },
              { name: 'Roles granted', value: roleNames.join(', ') || 'None', inline: false }
            )
            .setTimestamp(),
        ],
      })
      .catch((error) => console.error('Verification log failed:', error.message));
  }

  return {
    ok: true,
    submission,
    nicknameSet,
    rolesGranted: roleNames,
    createdRoles: granted.filter((entry) => entry.created).map((entry) => entry.role.name),
    failures,
  };
}

function canManageNicknames(guild) {
  return Boolean(guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageNicknames));
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  roleNameFor,
  ensureRole,
  applyVerification,
  parseSubmission,
  canManageNicknames,
  NICKNAME_MAX,
};