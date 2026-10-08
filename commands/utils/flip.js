const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('flip').setDescription('Flips a coin'),

  cooldown: 3000,

  async run(client, interaction) {
    const heads = Math.random() < 0.5;

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Coin Flip')
      .setDescription(heads ? '**Heads**' : '**Tails**');

    await interaction.reply({ embeds: [embed] });
  },
};