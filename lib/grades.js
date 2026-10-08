const { GRADES, MIN_GRADE, MAX_GRADE } = require('./verify');

const ORDINAL = /(?<!\d)(\d{1,2})(?!\d)(st|nd|rd|th)?/i;

function ordinalSuffix(value) {
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return 'th';

  switch (value % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function parseGradeFromName(name) {
  const match = String(name).match(ORDINAL);

  if (!match) return null;

  const grade = Number(match[1]);

  return GRADES.includes(grade) ? grade : null;
}

function buildRoleName(template, grade) {
  if (!template) return null;

  const match = String(template).match(ORDINAL);

  if (!match) return null;

  const hadSuffix = Boolean(match[2]);
  const replacement = hadSuffix ? `${grade}${ordinalSuffix(grade)}` : String(grade);

  return (
    String(template).slice(0, match.index) + replacement + String(template).slice(match.index + match[0].length)
  );
}

function findRoleByName(guild, name) {
  if (!name) return null;

  const target = String(name).toLowerCase();

  return guild.roles.cache.find((role) => role.name.toLowerCase() === target) ?? null;
}

function discoverGradeRoles(guild) {
  const discovered = new Map();

  for (const role of guild.roles.cache.values()) {
    const grade = parseGradeFromName(role.name);

    if (grade === null) continue;
    if (discovered.has(grade)) continue;

    discovered.set(grade, { grade, role, template: role.name });
  }

  return discovered;
}

function gradeSummary(discovered) {
  return [...discovered.values()]
    .sort((a, b) => a.grade - b.grade)
    .map((entry) => `${entry.role.name} (${entry.role.members.size})`)
    .join(', ');
}

function nextRoleNameFor(entry, discovered, config) {
  const isTop = entry.grade === MAX_GRADE;

  if (isTop) {
    return config.graduatedRoleName || 'The Graduated';
  }

  const existingNext = discovered.get(entry.grade + 1);

  if (existingNext) return existingNext.role.name;

  const template = [...discovered.values()].sort((a, b) => a.grade - b.grade)[0]?.template;

  return buildRoleName(template, entry.grade + 1) ?? `${config.gradeRolePrefix || 'grade'} ${entry.grade + 1}`;
}

module.exports = {
  GRADES,
  MIN_GRADE,
  MAX_GRADE,
  ordinalSuffix,
  parseGradeFromName,
  buildRoleName,
  findRoleByName,
  discoverGradeRoles,
  gradeSummary,
  nextRoleNameFor,
};