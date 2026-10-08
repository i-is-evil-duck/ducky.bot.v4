const { SlashCommandBuilder } = require('discord.js');

const MAX_INPUT = 380;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spoiled-msg')
    .setDescription('Spoils every character of your text')
    .addStringOption((opt) => opt.setName('text').setDescription('What to spoil').setRequired(true)),

  guildOnly: true,
  userPerms: ['ManageWebhooks'],
  botPerms: ['ManageWebhooks'],
  cooldown: 5000,

  async run(client, interaction) {
    const text = interaction.options.getString('text');

    if (text.length > MAX_INPUT) {
      await interaction.reply({
        content: `Keep it under ${MAX_INPUT} characters — each character becomes 5 once spoiled (you sent ${text.length}).`,
        ephemeral: true,
      });
      return;
    }

    const existing = await interaction.channel.fetchWebhooks().catch(() => null);
    const webhook = existing?.find((entry) => entry.name === 'spoiler-bot') ?? null;

    const hook =
      webhook ??
      (await interaction.channel.createWebhook({ name: 'spoiler-bot' }).catch(() => null));

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
      content: [...text].map((char) => `||${char}||`).join(''),
    });

    await interaction.reply({ content: 'Spoiled!', ephemeral: true });
  },
};