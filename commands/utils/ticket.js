const { EmbedBuilder, SlashCommandBuilder, ChannelType, OverwriteType } = require('discord.js');

const config = require('../../config.json');
const { tickets, verifyLog } = require('../../lib/db');
const { truncate } = require('../../lib/helpers');

const KIND_CHOICES = [
  { name: 'Verification', value: 'verification' },
  { name: 'Support', value: 'support' },
];

function verificationEmbed() {
  return new EmbedBuilder()
    .setColor('#eee657')
    .setTitle('Verification Questions')
    .setDescription('Please fill out the following questions:')
    .addFields(
      { name: '1. How did you join this server?', value: 'Answer here' },
      { name: '2. Are you on the Alpha Robotics team?', value: 'Answer here' },
      { name: '3. What is your name?', value: 'Answer here' },
      { name: '4. What team are you on?', value: 'Answer here' },
      { name: '5. Anything else we should know?', value: 'Answer here' }
    )
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open or close a private ticket thread')
    .addSubcommand((sub) =>
      sub
        .setName('open')
        .setDescription('Open a private ticket thread')
        .addStringOption((opt) =>
          opt
            .setName('kind')
            .setDescription('What is this ticket for?')
            .setRequired(true)
            .addChoices(...KIND_CHOICES)
        )
        .addStringOption((opt) =>
          opt.setName('subject').setDescription('A short summary of your issue').setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('Close one of your open tickets')
    ),

  guildOnly: true,
  cooldown: 5000,

  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'close') {
      const ticket = tickets.byChannel(interaction.channelId);

      if (!ticket || ticket.status !== 'open') {
        await interaction.reply({ content: 'This channel is not an open ticket.', ephemeral: true });
        return;
      }

      const canClose =
        ticket.user_id === interaction.user.id || interaction.member.permissions.has('ManageChannels');

      if (!canClose) {
        await interaction.reply({ content: 'You can only close your own tickets.', ephemeral: true });
        return;
      }

      tickets.close(ticket.id);
      await interaction.reply({ content: 'Ticket closed. Archiving this thread in 10 seconds.' });

      setTimeout(async () => {
        if (interaction.channel && interaction.channel.isThread()) {
          await interaction.channel.setArchived(true).catch(() => {});
        }
      }, 10_000);

      return;
    }

    if (!interaction.channel.isTextBased() || !interaction.channel.threads) {
      await interaction.reply({
        content: 'Tickets can only be opened in a text channel with threads enabled.',
        ephemeral: true,
      });
      return;
    }

    const existing = tickets.openForUser(guild.id, interaction.user.id);
    if (existing.length > 0) {
      const channels = await Promise.all(
        existing.map((row) => interaction.client.channels.fetch(row.channel_id).catch(() => null))
      );
      const links = channels.filter(Boolean).map((channel) => `<#${channel.id}>`);
      await interaction.reply({
        content: `You already have an open ticket: ${links.join(', ') || 'it could not be found'}`,
        ephemeral: true,
      });
      return;
    }

    const kind = interaction.options.getString('kind');
    const subject = interaction.options.getString('subject');

    const adminRole = guild.roles.cache.find(
      (role) => role.name.toLowerCase() === (config.adminRoleName ?? 'admin').toLowerCase()
    );

    let thread;

    try {
      thread = await interaction.channel.threads.create({
        name: `${interaction.user.username}'s ${kind}`,
        autoArchiveDuration: 1440,
        type: ChannelType.GuildPrivateThread,
        invitable: false,
      });
    } catch (error) {
      await interaction.reply({
        content: `Could not create a thread here: ${error.message}`,
        ephemeral: true,
      });
      return;
    }

    const overwrites = [{ id: interaction.user.id, type: OverwriteType.Member }];
    if (adminRole) overwrites.push({ id: adminRole.id, type: OverwriteType.Role });

    for (const overwrite of overwrites) {
      await thread.permissionOverwrites
        .edit(
          overwrite.id,
          { ViewChannel: true, SendMessages: true, SendMessagesInThreads: true },
          { type: overwrite.type }
        )
        .catch((error) => console.error('Failed to apply thread overwrite:', error.message));
    }

    const link = `https://discord.com/channels/${guild.id}/${thread.id}`;
    const ticketId = tickets.open({
      guildId: guild.id,
      channelId: thread.id,
      userId: interaction.user.id,
      kind,
      subject,
    });

    if (kind === 'verification') {
      verifyLog.add({
        guildId: guild.id,
        userId: interaction.user.id,
        sourceMessageId: thread.id,
      });
    }

    const adminMention = adminRole ? `<@&${adminRole.id}>` : 'the server staff';

    await thread.send({
      content: `${adminMention} — <@${interaction.user.id}> opened a **${kind}** ticket.${subject ? `\nSubject: ${subject}` : ''}`,
      embeds: kind === 'verification' ? [verificationEmbed()] : [],
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Ticket Opened')
      .setDescription(`Ticket **#${ticketId}** is ready: <#${thread.id}>`)
      .setURL(link)
      .setFooter({ text: `Use /ticket close inside the thread when you are done` });

    await interaction.reply({ embeds: [embed], ephemeral: true });

    if (config.modLogChannelId) {
      const logChannel = guild.channels.cache.get(config.modLogChannelId);
      if (logChannel?.isTextBased()) {
        await logChannel
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Ticket opened')
                .setDescription(
                  `${interaction.user.tag} opened a **${truncate(kind, 32)}** ticket: <#${thread.id}>${subject ? `\n${truncate(subject, 200)}` : ''}`
                )
                .setTimestamp(),
            ],
          })
          .catch((error) => console.error('Mod log failed:', error.message));
      }
    }
  },
};