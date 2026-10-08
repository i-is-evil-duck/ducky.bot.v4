const { SlashCommandBuilder } = require('discord.js');

const { sendRandomImage } = require('./cats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('waifu')
    .setDescription('Displays a random image from the local library'),

  cooldown: 5000,

  run(client, interaction) {
    return sendRandomImage(client, interaction, 'waifu', 'Random image');
  },
};