const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { reminders } = require('../../lib/db');
const { formatDuration } = require('../../lib/helpers');

const MAX_TIMER = 2_147_483_647;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder that gets DMed to you')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Create a new reminder')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('How many seconds from now should the reminder fire?')
            .setMinValue(1)
            .setMaxValue(MAX_TIMER)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('message').setDescription('What should the reminder say?').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List your pending reminders'))
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel one of your pending reminders')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('The reminder ID from /remind list').setMinValue(1).setRequired(true)
        )
    ),

  cooldown: 3000,

  async run(client, interaction, args) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const seconds = interaction.options.getInteger('seconds');
      const message = interaction.options.getString('message');

      if (!message.trim()) {
        await interaction.reply({ content: 'The reminder text cannot be empty.', ephemeral: true });
        return;
      }

      const id = reminders.add({
        userId: interaction.user.id,
        createdBy: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        message,
        dueAt: Date.now() + seconds * 1000,
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Reminder Set')
        .setDescription(`I'll remind you in **${formatDuration(seconds * 1000)}**.`)
        .addFields({ name: 'ID', value: `#${id}` })
        .setFooter({ text: `Use /remind cancel id:${id} to cancel it` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      const pending = reminders.pendingFor(interaction.user.id);

      if (pending.length === 0) {
        await interaction.reply({ content: 'You have no pending reminders.', ephemeral: true });
        return;
      }

      const lines = pending.map(
        (reminder) =>
          `**#${reminder.id}** — in ${formatDuration(reminder.due_at - Date.now())}: ${reminder.message.slice(0, 80)}`
      );

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Pending reminders (${pending.length})`)
        .setDescription(lines.slice(0, 15).join('\n'))
        .setFooter({
          text: pending.length > 15 ? `and ${pending.length - 15} more...` : client.user.tag,
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const id = interaction.options.getInteger('id');

    if (!reminders.cancel(id, interaction.user.id)) {
      await interaction.reply({
        content: `Reminder **#${id}** was not found, or it is no longer pending.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: `✅ Cancelled reminder **#${id}**.`, ephemeral: true });
  },
};