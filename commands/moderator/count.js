const { WebhookClient } = require('discord.js');

module.exports = {
  name: 'count',
  description: 'Creates multiple webhooks and sends a message a specified amount of times',
  usage: '!count <number of messages>',
  userPerms: ['Administrator'],
	botPerms: ['Administrator'],
  run: async (client, message, args) => {
    // Get the number of messages to send from the command arguments
    const count = parseInt(args[0]);

    // Check if the argument is a number
    if (isNaN(count)) {
      return message.reply('You need to provide a number!');
    }

    // Get the channel where the message was sent
    const channel = message.channel;

    // Limit the number of webhooks created to 10
    const maxWebhooks = 10;
    const numWebhooks = Math.min(count, maxWebhooks);

    // Create an array to hold the webhooks
    const webhooks = [];

    // Loop to create multiple webhooks
    for (let i = 0; i < numWebhooks; i++) {
      // Check if a webhook with the name 'count' already exists
      const existingWebhooks = await channel.fetchWebhooks();
      let webhook = existingWebhooks.find(webhook => webhook.name === `count-${i}`);

      // If a webhook with the name 'count' doesn't exist, create one
      if (!webhook) {
        const newWebhook = await channel.createWebhook({
          name: `count-${i}`,
        });
        webhook = newWebhook;
      }

      // Add the webhook to the array
      webhooks.push(webhook);
    }

    // Loop through and send the messages
    let webhookIndex = 0;
    for (let i = 1; i <= count; i++) {
      // Create the message content
      const messageContent = `${i}`;

      // Get the current webhook to use
      const webhook = webhooks[webhookIndex];

      // Create a new message to send via the webhook
      const webhookMessage = {
        username: message.author.username,
        avatarURL: message.author.avatarURL(),
        content: messageContent
      };

      // Send the message via the webhook
      await webhook.send(webhookMessage);

      // Increment the webhook index to switch to the next one for the next message
      webhookIndex = (webhookIndex + 1) % numWebhooks;
    }

    // Delete the user's original message
    await message.delete();
  }
};
