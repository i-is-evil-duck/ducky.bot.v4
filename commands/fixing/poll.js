const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'poll',
  description: 'Creates a poll',
  cooldown: 3000,
  run: async (client, message, args) => {
    // Parse arguments
    const title = args.shift().replace(/^"(.*)"$/, '$1');
    const options = args.map(arg => arg.replace(/^"(.*)"$/, '$1'));

    // Create poll message
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor('#0099ff');

    options.forEach(option => {
      embed.addFields({
        name: option,
        value: '\u200B',
        inline: false
      });
    });

    message.channel.send({ embeds: [embed] });
  }
};
