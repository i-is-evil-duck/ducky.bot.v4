const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'whois',
  description: 'Shows information about a user',
  cooldown: 3000,
  run: async (client, message, args) => {
    let mentionedMember;

    if (message.mentions.members.size > 0) {
      mentionedMember = message.mentions.members.first();
    } else {
      mentionedMember = message.member;
    }

    const username = mentionedMember.user.username;
    const avatar = mentionedMember.user.avatarURL({ format: 'png', dynamic: true, size: 2048 });
    const nickname = mentionedMember.nickname || 'None';
    const status = mentionedMember.presence.status || 'Offline';

    const memberEmbed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`${username}`)
      .setThumbnail(avatar)
      .setTimestamp()
      .setFooter({ text: client.user.tag });

    const userIdField = { name: 'User ID', value: mentionedMember.user.id, inline: true };
const rolesField = {
  name: 'Roles',
  value: mentionedMember.roles.cache.map((role) => role.name.startsWith('@') ? role.name : `@${role.name}`).join(', ') || 'None',
  inline: true,
};

    const nicknameField = { name: 'Nickname', value: nickname, inline: true };
    const statusField = { name: 'Status', value: status, inline: true };
    const accountAge = Math.round((new Date() - mentionedMember.user.createdAt) / (1000 * 60 * 60 * 24));
    const joinedDate = mentionedMember.joinedAt.toDateString();
    const serverAge = Math.round((new Date() - mentionedMember.joinedAt) / (1000 * 60 * 60 * 24));

    const ageField = { name: 'Account Age', value: `${accountAge} days old`, inline: true };
    const joinedField = { name: 'Joined Server', value: `${serverAge} days ago (${joinedDate})`, inline: true };

    memberEmbed.addFields(userIdField, rolesField, statusField, joinedField, ageField, nicknameField);

    // Check for -perms flag
    if (args.includes('-perms')) {
      const mentionedMember = message.mentions.members.first() || message.member;

      const memberPerms = mentionedMember.permissions.toArray();
      const memberPermList = memberPerms.map((perm) => `\`${perm}\``).join(', ');

      const memberEmbed = new EmbedBuilder()
        .setColor('#eee657')
        .setTitle(`Permissions for ${mentionedMember.user.tag}`)
        .addFields({
          name: 'Permissions',
          value: memberPermList || 'None',
          inline: true,
        })
        .setTimestamp()
        .setFooter({ text: client.user.tag });

      return message.reply({ embeds: [memberEmbed] });
    }

    return message.reply({ embeds: [memberEmbed] });
  },
};
