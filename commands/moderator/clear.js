const Discord = require('discord.js');

module.exports = {
  name: 'clear',
  description: "Alternative(!del)or(!delete)",
  cooldown: 3000,
  userPerms: ['MANAGE_MESSAGES'],
  botPerms: ['MANAGE_MESSAGES'],
  run: async (client, message, args) => {
    const words = message.content.split(" ");
    let maxDelete = 500; // Maximum number of messages that can be deleted at once

    // Check if the user specified the "until" option
    if (words.includes("until")) {
      // Check if the user provided the message ID of the message to stop at
      if (args.length < 2) {
        return message.channel.send("Please provide the message ID of the message to stop at.");
      }

      // Parse the message ID of the message to stop at
      const untilMessageId = args[1];

      // Fetch all messages in the channel
      const messages = await message.channel.messages.fetch({ limit: 100 });

      // Get the untilMessage from the messages cache
      const untilMessage = messages.get(untilMessageId);
      if (!untilMessage) {
        return message.channel.send("Could not find the specified message.");
      }

      // Filter the messages to only include those after the specified message
      const messagesToDelete = messages.filter(m => m.id !== message.id && m.createdTimestamp > untilMessage.createdTimestamp);

      // Delete the filtered messages
      return message.channel.bulkDelete(messagesToDelete)
        .then(() => {
          // Confirm that the messages were deleted
          return message.channel.send(`Deleted ${messagesToDelete.size} messages.`);
        })
        .catch(error => {
          // Handle any errors that occur
          return message.channel.send(`An error occurred: ${error}`);
        })
        .finally(() => {
          // Delete the command message
          return message.delete();
        });
    } else if (words.includes("between")) {
      // Check if the user provided two message IDs
      if (args.length < 3) {
        return message.channel.send("Please provide the message IDs of the messages to delete between.");
      }

      // Parse the message IDs
      const startMessageId = args[1];
      const endMessageId = args[2];

      // Fetch all messages in the channel
      const messages = await message.channel.messages.fetch({ limit: 100 });

      // Get the startMessage and endMessage from the messages cache
      const startMessage = messages.get(startMessageId);
      const endMessage = messages.get(endMessageId);
      if (!startMessage || !endMessage) {
        return message.channel.send("Could not find the specified messages.");
      }

      // Filter the messages to only include those between the specified messages
      const messagesToDelete = messages.filter(m => m.id !== message.id && m.createdTimestamp > startMessage.createdTimestamp && m.createdTimestamp < endMessage.createdTimestamp);

      // Delete the filtered messages
      return message.channel.bulkDelete(messagesToDelete)
        .then(() => {
          // Confirm that the messages were deleted
          return message.channel.send(`Deleted ${messagesToDelete.size} messages.`);
        })
        .catch(error => {
          // Handle any errors that occur
          return message.channel.send(`An error occurred: ${error}`);
        })
        .finally(() => {
          // Delete the command message
          return message.delete();
});
} else {
if (args.length === 0) {
return message.channel.send("Please provide the number of messages to delete.");
}  const count = parseInt(args[0]);
  if (isNaN(count)) {
    return message.channel.send("Please provide a valid number of messages to delete.");
  }
  if (count > maxDelete) {
    return message.channel.send(`I can only delete ${maxDelete} messages at a time.`);
  }

  const messages = await message.channel.messages.fetch({ limit: count, before: message.id });

  return message.channel.bulkDelete(messages)
    .then(() => {
      return message.channel.send(`Deleted ${messages.size} messages.`);
    })
    .catch(error => {
      return message.channel.send(`An error occurred: ${error}`);
    })
    .finally(() => {
      return message.delete();
    });
}
}
};

module.exports.help = {
name: "del",
description: "Deletes specified amount of messages (!del), or until message ID (!del until 'put message ID here'), or messages between two message IDs (!del between 'put start message ID here' 'put end message ID here')",
usage: "!del <number of messages> or !del until <message ID> or !del between <start message ID> <end message ID>",
example: "!del 50 or !del until 1234567890 or !del between 1234567890 1234567891",
cooldown: 3000,
userPerms: ['ADMINISTRATOR'],
botPerms: ['ADMINISTRATOR']
};




