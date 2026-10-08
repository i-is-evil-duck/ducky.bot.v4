const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'info',
  description: 'Sends information about the current server, such as the number of members and channels.',
  run: async (client, message, args) => {
    const guild = message.guild;
    const memberCount = guild.memberCount;
    const channelCount = guild.channels.cache.filter(channel => channel.type !== 'category').size;
    const roleCount = guild.roles.cache.size;

const embed = new EmbedBuilder()
  .setTitle(`${message.guild.name} Server Info`)
  .setColor('#0099ff')
  .addFields(
    { name: 'Members', value: `${message.guild.memberCount.toString()}`, inline: true },
    { name: 'Channels', value: `${message.guild.channels.cache.size.toString()}`, inline: true }
  )
  .setTimestamp();


    message.channel.send({ embeds: [embed] });
  }
};
