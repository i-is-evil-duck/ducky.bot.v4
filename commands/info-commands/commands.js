const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'commands',
  description: 'Lists all commands',
  run: (client, message, args) => {
    const commands = client.commands;

    // Create a string with the command list
    let commandList = '```';

    commands.forEach((command) => {
      commandList += `${command.name}: ${command.description || "No description provided."}\n`;
    });

    commandList += '```';

    const embed = new EmbedBuilder()
      .setTitle('Available Commands')
      .setColor('#eee657')
      .setTimestamp()
      .setFooter({ text: client.user.tag })
      .setDescription(commandList);

    message.reply({ embeds: [embed] });
  }
};
