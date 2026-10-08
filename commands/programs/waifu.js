const { SlashCommandBuilder } = require('discord.js');

const { maintenanceEmbed, sendRandomImage } = require('./cats');

const MAINTENANCE = true;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('waifu')
    .setDescription('Displays a random image from the local library'),

  cooldown: 5000,

  async run(client, interaction) {
    if (MAINTENANCE) {
      await interaction.reply({ embeds: [maintenanceEmbed(client, 'waifu pictures')] });
      return;
    }

    await sendRandomImage(client, interaction, 'waifu', 'Random image');
  },
};