const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'bot',
  description: 'Shows information about the bot',
  cooldown: 3000,
  run: async (client, message, args) => {
    const username = client.user.username;
    const avatar = client.user.avatarURL({ format: 'png', dynamic: true, size: 2048 });

    const inviteLink = 'https://discord.com/api/oauth2/authorize?client_id=1051985576427004031&permissions=8&scope=applications.commands%20bot';
    const botEmbed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`${username}`)
      .setThumbnail(avatar)
      .setTimestamp()
      .setFooter({ text: client.user.tag })
      .addFields(
        { name: 'Owner ID', value: client.application?.owner?.id ?? 'Unknown', inline: true },
        { name: 'Version', value: process.env.npm_package_version ?? 'Unknown', inline: true },
        { name: 'Uptime', value: `${Math.round(client.uptime / 1000)} seconds`, inline: true },
        { name: 'Guilds', value: client.guilds.cache.size.toLocaleString() || 'Unknown', inline: true },
        { name: 'Users', value: client.users.cache.size.toLocaleString() || 'Unknown', inline: true },
        { name: 'Memory Usage', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: 'Node.js Version', value: process.version || 'Unknown', inline: true },
        { name: 'Discord.js Version', value: require('discord.js').version || 'Unknown', inline: true },
        { name: 'Invite Link', value: `[INVITE](${inviteLink})`, inline: false }
      );

    return message.reply({ embeds: [botEmbed] });
  }
};
