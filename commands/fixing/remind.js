const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'remind',
  description: 'Sends a DM reminder to the user after a specified amount of time',
  usage: '!remindme <time> <message>',
  run: async (client, message, args) => {
    // Get the reminder time and message from the command arguments
    const time = args.shift();
    const reminderMessage = args.join(' ');

    // Check if the time argument is a valid number
    if (isNaN(time)) {
      return message.reply('You need to provide a valid time!');
    }

    // Convert the time to milliseconds
    const timeInMs = time * 1000;

    // Schedule the reminder message to be sent after the specified time
    setTimeout(() => {
      // Create a DM channel with the user
      message.author.createDM().then(dmChannel => {
        // Create an embed for the reminder message
        const embed = new EmbedBuilder()
          .setTitle('Reminder')
          .setDescription(reminderMessage)
          .setColor('#FF0000')
          .setTimestamp()
      .setFooter({ text: client.user.tag })
          .build();

        // Send the reminder message in the DM channel
        dmChannel.send({ embeds: [embed] });
      });
    }, timeInMs);

    // Send a confirmation message in the original channel
    const confirmEmbed = new EmbedBuilder()
      .setTitle('Reminder Set')
      .setDescription(`I will remind you in ${time} seconds!`)
      .setColor('#00FF00')
      .setTimestamp()
      .setFooter(client.user.tag)
      .build();

    message.channel.send({ embeds: [confirmEmbed] });
  },
};
