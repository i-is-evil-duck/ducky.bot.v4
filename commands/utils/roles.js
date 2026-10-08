const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'roles',
  description: "Shows all roles and their permissions",
  cooldown: 3000,
  run: async (client, message, args) => {
    const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position).map(role => role.toString());

    let role = message.mentions.roles.first(); // Check if a role is mentioned
    if (role) {
      // If a role is mentioned, add its permissions to the embed message
      let permissions = role.permissions.toArray().map(p => `\`${p}\``).join(', ');
      if (!permissions) permissions = 'Default';
      const embed = new EmbedBuilder()
        .setTitle(`Permissions of ${role.name}`)
        .setDescription(permissions)
        .setColor('#eee657')
        .setTimestamp()
        .setFooter({ text: client.user.tag });
      message.reply({ embeds: [embed] });
    } else {
      // If no role is mentioned, show a list of all roles and their positions
      const embed = new EmbedBuilder()
        .setTitle('Roles')
        .setDescription(`List of roles and their positions on this server:\n\n${roles.join('\n')}`)
        .setColor('#eee657')
        .setTimestamp()
        .setFooter({ text: client.user.tag });
      message.reply({ embeds: [embed] });
    }
  }
};
