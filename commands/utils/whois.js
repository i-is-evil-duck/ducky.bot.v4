const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Shows information about a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Who? Defaults to you')),

  guildOnly: true,
  cooldown: 3000,

  async run(client, interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({
        content: `${user.tag} is not a member of this server.`,
        ephemeral: true,
      });
      return;
    }

    const roles = [...member.roles.cache.values()]
      .filter((role) => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => role.toString());

    const status = member.presence?.status ?? 'offline';
    const joinedAt = member.joinedAt;

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Nickname', value: member.nickname ?? 'None', inline: true },
        { name: 'Status', value: status, inline: true },
        {
          name: 'Account created',
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: 'Joined server',
          value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` : 'Unknown',
          inline: true,
        },
        { name: 'Roles', value: truncate(roles.join(', ') || 'None', 1020), inline: false },
        {
          name: 'Highest role',
          value: member.roles.highest?.id ? `<@&${member.roles.highest.id}>` : 'None',
          inline: true,
        },
        {
          name: 'Timed out until',
          value: member.communicationDisabledUntil
            ? `<t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:R>`
            : 'Not timed out',
          inline: true,
        }
      )
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};