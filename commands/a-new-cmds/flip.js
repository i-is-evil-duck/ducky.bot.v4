const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'flip',
  description: 'Flips a coin and responds with either "heads" or "tails."',
  usage: '!flip',
  run: async (client, message, args) => {
    // Generate a random number between 0 and 1
    const coin = Math.floor(Math.random() * 2);

    // Create the embed with the result of the coin flip
    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Coin Flip')
      .addFields(
        { name: 'Result', value: coin === 0 ? 'Heads' : 'Tails' }
      );

    // Send the embed as a reply to the message
    message.reply({ embeds: [embed] });
  }
};
