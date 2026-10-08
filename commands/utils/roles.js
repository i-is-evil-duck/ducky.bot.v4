const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Shows server roles, or the permissions of one role')
    .addRoleOption((opt) => opt.setName('role').setDescription('Show only this role')),

  guildOnly: true,
  cooldown: 5000,

  async run(client, interaction) {
    const role = interaction.options.getRole('role');

    if (role) {
      const permissions = role.permissions.toArray().map((perm) => `\`${perm}\``);

      const embed = new EmbedBuilder()
        .setColor('#eee657')
        .setTitle(`Permissions of ${role.name}`)
        .setDescription(truncate(permissions.join(', ') || 'None', 4090))
        .setFooter({ text: client.user.tag })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const roles = [...interaction.guild.roles.cache.values()]
      .filter((entry) => entry.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((entry) => entry.toString());

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`Roles in ${interaction.guild.name} (${roles.length})`)
      .setDescription(truncate(roles.join('\n') || 'None', 4090))
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};