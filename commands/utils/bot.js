const { EmbedBuilder, SlashCommandBuilder, version: djsVersion } = require('discord.js');

const pkg = require('../../package.json');

module.exports = {
  data: new SlashCommandBuilder().setName('bot').setDescription('Shows information about the bot'),

  cooldown: 5000,

  async run(client, interaction) {
    const inviteLink = client.user
      ? `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=applications.commands%20bot&permissions=402926592`
      : null;

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(client.user.username)
      .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: 'Version', value: pkg.version, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
        { name: 'Guilds', value: client.guilds.cache.size.toLocaleString(), inline: true },
        { name: 'Users cached', value: client.users.cache.size.toLocaleString(), inline: true },
        { name: 'Commands', value: client.slashCommands.size.toLocaleString(), inline: true },
        { name: 'Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'discord.js', value: djsVersion, inline: true },
        {
          name: 'Invite',
          value: inviteLink ? `[Add ${client.user.username}](${inviteLink})` : 'Unavailable',
          inline: false,
        }
      )
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};