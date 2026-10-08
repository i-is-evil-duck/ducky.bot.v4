const { Collection, EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
const MAX_BULK = 100;
const FETCH_LIMIT = 100;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addSubcommand((sub) =>
      sub
        .setName('amount')
        .setDescription('Delete the N most recent messages')
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('How many messages to delete')
            .setMinValue(1)
            .setMaxValue(MAX_BULK)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('until')
        .setDescription('Delete everything newer than a message')
        .addStringOption((opt) =>
          opt.setName('message-id').setDescription('The message to stop at').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('between')
        .setDescription('Delete everything between two messages')
        .addStringOption((opt) =>
          opt.setName('start-id').setDescription('First message of the range').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('end-id').setDescription('Last message of the range').setRequired(true)
        )
    ),

  guildOnly: true,
  userPerms: ['ManageMessages'],
  botPerms: ['ManageMessages'],
  cooldown: 3000,

  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    if (!channel.isTextBased()) {
      await interaction.reply({ content: 'I can only delete messages in text channels.', ephemeral: true });
      return;
    }

    const cutoff = Date.now() - TWO_WEEKS;
    let toDelete = new Collection();

    try {
      if (subcommand === 'amount') {
        const count = interaction.options.getInteger('count');
        const messages = await channel.messages.fetch({ limit: count });

        toDelete = messages.filter((msg) => msg.createdTimestamp >= cutoff);
      } else if (subcommand === 'until') {
        const id = interaction.options.getString('message-id').trim();
        const messages = await channel.messages.fetch({ limit: FETCH_LIMIT });
        const untilMessage = messages.get(id);

        if (!untilMessage) {
          await interaction.reply({
            content: 'That message is not in the last 100 messages of this channel.',
            ephemeral: true,
          });
          return;
        }

        toDelete = messages.filter(
          (msg) => msg.createdTimestamp > untilMessage.createdTimestamp && msg.createdTimestamp >= cutoff
        );
      } else {
        const startId = interaction.options.getString('start-id').trim();
        const endId = interaction.options.getString('end-id').trim();
        const messages = await channel.messages.fetch({ limit: FETCH_LIMIT });

        const startMessage = messages.get(startId);
        const endMessage = messages.get(endId);

        if (!startMessage || !endMessage) {
          await interaction.reply({
            content: 'One of those messages is not in the last 100 messages of this channel.',
            ephemeral: true,
          });
          return;
        }

        const from = Math.min(startMessage.createdTimestamp, endMessage.createdTimestamp);
        const to = Math.max(startMessage.createdTimestamp, endMessage.createdTimestamp);

        toDelete = messages.filter(
          (msg) => msg.createdTimestamp > from && msg.createdTimestamp < to && msg.createdTimestamp >= cutoff
        );
      }
    } catch (error) {
      await interaction.reply({ content: `Could not fetch messages: ${error.message}`, ephemeral: true });
      return;
    }

    if (toDelete.size === 0) {
      await interaction.reply({
        content:
          subcommand === 'amount'
            ? 'Nothing to delete (Discord cannot bulk delete messages older than 14 days).'
            : 'No messages matched that range.',
        ephemeral: true,
      });
      return;
    }

    const deleted = await channel.bulkDelete(toDelete, true).catch((error) => {
      console.error('Bulk delete failed:', error);
      return null;
    });

    const embed = new EmbedBuilder()
      .setColor(deleted ? '#00FF00' : '#FF0000')
      .setTitle(deleted ? 'Messages deleted' : 'Bulk delete failed')
      .setDescription(
        deleted
          ? `Removed **${deleted.size}** message${deleted.size === 1 ? '' : 's'}.`
          : 'Discord rejected the bulk delete.'
      )
      .setFooter({ text: `${interaction.user.tag} used /purge ${subcommand}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};