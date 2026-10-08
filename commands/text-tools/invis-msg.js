const { SlashCommandBuilder } = require('discord.js');

const { INVISIBLE_PATTERN, MAX_CONTENT } = require('../../lib/invisible');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invis-msg')
    .setDescription('Sends a message with hidden text appended')
    .addStringOption((opt) =>
      opt.setName('visible').setDescription('The visible part').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('hidden').setDescription('The part nobody should see')
    ),

  guildOnly: true,
  userPerms: ['ManageWebhooks'],
  botPerms: ['ManageWebhooks'],
  cooldown: 5000,

  async run(client, interaction) {
    const visible = interaction.options.getString('visible');
    const hidden = interaction.options.getString('hidden') ?? '';

    const content = `${visible} ${INVISIBLE_PATTERN}${hidden}`;

    if (content.length > MAX_CONTENT) {
      await interaction.reply({
        content: `That would be ${content.length} characters — Discord only allows ${MAX_CONTENT}.`,
        ephemeral: true,
      });
      return;
    }

    const existing = await interaction.channel.fetchWebhooks().catch(() => null);
    const webhook = existing?.find((entry) => entry.name === 'ligma') ?? null;

    const hook =
      webhook ?? (await interaction.channel.createWebhook({ name: 'ligma' }).catch(() => null));

    if (!hook) {
      await interaction.reply({
        content: 'I could not create a webhook in this channel.',
        ephemeral: true,
      });
      return;
    }

    await hook.send({
      username: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
      content,
    });

    await interaction.reply({ content: 'Sent!', ephemeral: true });
  },
};