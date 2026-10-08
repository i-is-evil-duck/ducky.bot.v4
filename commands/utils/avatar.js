const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Displays a user's avatar")
    .addUserOption((opt) => opt.setName('user').setDescription('Whose avatar? Defaults to you')),

  cooldown: 3000,

  async run(client, interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`${user.username}'s avatar`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};