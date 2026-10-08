const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Rolls dice')
    .addIntegerOption((opt) =>
      opt
        .setName('sides')
        .setDescription('How many sides? Defaults to 6')
        .setMinValue(2)
        .setMaxValue(1000)
    )
    .addIntegerOption((opt) =>
      opt.setName('count').setDescription('How many dice? Defaults to 1').setMinValue(1).setMaxValue(25)
    ),

  cooldown: 3000,

  async run(client, interaction) {
    const sides = interaction.options.getInteger('sides') ?? 6;
    const count = interaction.options.getInteger('count') ?? 1;

    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('🎲 Dice roll')
      .setDescription(rolls.join(', '))
      .addFields({ name: 'Total', value: String(total), inline: true })
      .setFooter({ text: `${count}d${sides} · ${client.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};