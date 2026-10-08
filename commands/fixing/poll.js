const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll people can vote on with buttons')
    .addStringOption((opt) =>
      opt.setName('title').setDescription('The question').setRequired(true).setMaxLength(256)
    )
    .addStringOption((opt) =>
      opt.setName('option-1').setDescription('First option').setRequired(true).setMaxLength(80)
    )
    .addStringOption((opt) =>
      opt.setName('option-2').setDescription('Second option').setRequired(true).setMaxLength(80)
    )
    .addStringOption((opt) =>
      opt.setName('option-3').setDescription('Third option (optional)').setMaxLength(80)
    )
    .addStringOption((opt) =>
      opt.setName('option-4').setDescription('Fourth option (optional)').setMaxLength(80)
    )
    .addStringOption((opt) =>
      opt.setName('option-5').setDescription('Fifth option (optional)').setMaxLength(80)
    ),

  cooldown: 5000,

  async run(client, interaction) {
    const options = ['option-1', 'option-2', 'option-3', 'option-4', 'option-5']
      .map((name) => interaction.options.getString(name))
      .filter(Boolean);

    if (options.length < 2) {
      await interaction.reply({ content: 'A poll needs at least two options.', ephemeral: true });
      return;
    }

    const { buildPoll } = require('../../lib/poll');

    const { embed, components } = buildPoll({
      question: interaction.options.getString('title'),
      options,
      footer: client.user.tag,
    });

    const message = await interaction.reply({ embeds: [embed], components });

    client.polls.set(message.id, {
      question: interaction.options.getString('title'),
      options,
      votes: new Map(),
    });
  },
};