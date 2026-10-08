const { ApplicationCommandOptionType } = require('discord.js');

function flatten(options) {
  const out = [];
  for (const option of options) {
    if (
      option.type === ApplicationCommandOptionType.Subcommand ||
      option.type === ApplicationCommandOptionType.SubcommandGroup
    ) {
      out.push(...flatten(option.options ?? []));
    } else {
      out.push(option);
    }
  }
  return out;
}

function getArgs(interaction) {
  return flatten(interaction.options.data)
    .filter((option) => option.name !== 'reason')
    .map((option) => option.value);
}

function getOption(interaction, name) {
  const found = flatten(interaction.options.data).find((option) => option.name === name);
  return found ? found.value : undefined;
}

const truncate = (value, max = 1000, suffix = '\u2026') => {
  const str = String(value ?? '');
  return str.length <= max ? str : str.slice(0, max - suffix.length) + suffix;
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
};

module.exports = { getArgs, getOption, truncate, formatDuration };