const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'members',
  description: "Shows member count of the server",
  cooldown: 3000,
run: async (client, message, args) => {
  const onlineMembers = message.guild.members.cache.filter(member => member.presence?.status === 'online');
  const idleMembers = message.guild.members.cache.filter(member => member.presence?.status === 'idle');
  const dndMembers = message.guild.members.cache.filter(member => member.presence?.status === 'dnd');
  const offlineMembers = [];

  for (const member of message.guild.members.cache.values()) {
    if (!member.presence) {
      // If the member has no presence information, assume they are offline.
      offlineMembers.push(member);
    } else if (member.presence.status === 'offline') {
      // If the member is offline, add them to the offlineMembers array.
      offlineMembers.push(member);
    }
  }

  const onlineEmoji = '<:online:1090879847309529088>';
  const idleEmoji = '<:idle:1090879831996121150>';
  const dndEmoji = '<:dnd:1090879818180087808>';
  const offlineEmoji = '<:offline:1090879789939838986>';

  const embed = new EmbedBuilder()
    .setTitle(`Member Count: ${message.guild.memberCount}`)
    .setColor('#eee657')
    .addFields(
      { name: `${onlineEmoji} Online`, value: onlineMembers.map(member => `<@${member.id}>`).join('\n') || 'None' },
      { name: `${idleEmoji} Idle`, value: idleMembers.map(member => `<@${member.id}>`).join('\n') || 'None' },
      { name: `${dndEmoji} Do Not Disturb`, value: dndMembers.map(member => `<@${member.id}>`).join('\n') || 'None' },
      { name: `${offlineEmoji} Offline`, value: offlineMembers.map(member => `<@${member.id}>`).join('\n') || 'None' }
    )
    .setTimestamp()
    .setFooter({ text: client.user.tag });

  message.reply({ embeds: [embed] });
}
};