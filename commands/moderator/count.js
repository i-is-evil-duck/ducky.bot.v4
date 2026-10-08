const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const MAX_SENDS = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Counts up to a limit by spamming webhooks')
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('How many messages to send')
        .setMinValue(1)
        .setMaxValue(MAX_SENDS)
        .setRequired(true)
    ),

  guildOnly: true,
  userPerms: ['ManageWebhooks'],
  botPerms: ['ManageWebhooks'],
  cooldown: 30000,

  async run(client, interaction) {
    const count = interaction.options.getInteger('count');

    if (!interaction.channel.isTextBased()) {
      await interaction.reply({ content: 'This channel cannot receive webhooks.', ephemeral: true });
      return;
    }

    const existing = await interaction.channel.fetchWebhooks().catch(() => null);
    const reused = existing?.find((entry) => entry.name === 'count');
    const hook = reused ?? (await interaction.channel.createWebhook({ name: 'count' }).catch(() => null));

    if (!hook) {
      await interaction.reply({ content: 'I could not create a webhook here.', ephemeral: true });
      return;
    }

    const created = !reused;

    try {
      for (let i = 1; i <= count; i++) {
        await hook.send({
          username: interaction.user.username,
          avatarURL: interaction.user.displayAvatarURL(),
          content: String(i),
        });
      }
    } catch (error) {
      console.error('Count command failed:', error);
      await interaction
        .reply({ content: `Stopped at ${i - 1}: ${error.message}`, ephemeral: true })
        .catch(() => {});
      return;
    } finally {
      if (created) await hook.delete().catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`Counted to ${count}`)
      .setFooter({ text: interaction.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};