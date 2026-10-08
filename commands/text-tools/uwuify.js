const { SlashCommandBuilder } = require('discord.js');

const owoify = require('owoify-js').default;
const stutterify = require('stutterify');

const MAX_LENGTH = 1800;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uwu')
    .setDescription('Uwufies your text')
    .addStringOption((opt) => opt.setName('text').setDescription('What to uwuify').setRequired(true)),

  guildOnly: true,
  userPerms: ['ManageWebhooks'],
  botPerms: ['ManageWebhooks'],
  cooldown: 5000,

  async run(client, interaction) {
    const text = interaction.options.getString('text');

    const existing = await interaction.channel.fetchWebhooks().catch(() => null);
    const webhook = existing?.find((entry) => entry.name === 'UWU') ?? null;

    const hook =
      webhook ?? (await interaction.channel.createWebhook({ name: 'UWU' }).catch(() => null));

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
      content: stutterify(owoify(text)).slice(0, MAX_LENGTH),
    });

    await interaction.reply({ content: 'Uwufied!', ephemeral: true });
  },
};