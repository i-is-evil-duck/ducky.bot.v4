const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const { truncate } = require('./helpers');

const MAX_OPTIONS = 5;

function buildPoll({ question, options, footer }) {
  const limited = options.slice(0, MAX_OPTIONS);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(truncate(question, 256))
    .setDescription(
      limited.map((option, index) => `${index + 1}. ${truncate(option, 80)} — **0** votes`).join('\n')
    )
    .setFooter({ text: footer ?? 'Ducky Bot' });

  const components = [
    new ActionRowBuilder().addComponents(
      limited.map((option, index) =>
        new ButtonBuilder()
          .setCustomId(`poll:vote:${index}`)
          .setLabel(truncate(option, 80))
          .setStyle(ButtonStyle.Secondary)
      )
    ),
  ];

  return { embed, components };
}

function renderResults({ question, options, votes }) {
  const sorted = options
    .map((option, index) => ({ option, index, count: votes.get(index) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const total = sorted.reduce((sum, entry) => sum + entry.count, 0);

  const lines = sorted.map((entry) => {
    const percent = total === 0 ? 0 : Math.round((entry.count / total) * 100);
    const bar = '\u{1F4A5}'.repeat(Math.min(10, Math.round(percent / 10)));
    return `${bar || '\u{1F4A5}'} **${truncate(entry.option, 60)}** — ${entry.count} (${percent}%)`;
  });

  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(truncate(question, 256))
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${total} vote${total === 1 ? '' : 's'}` });
}

module.exports = { buildPoll, renderResults, MAX_OPTIONS };