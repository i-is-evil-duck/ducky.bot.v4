const { WebhookClient } = require('discord.js');
const owoify = require('owoify-js').default;
const stutterify = require('stutterify');

module.exports = {
  name: 'uwu',
  description: 'Creates a new webhook',
  run: async (client, message, args) => {
    const channel = message.channel;

    // Check if a webhook with the name 'UWU' already exists
    const existingWebhooks = await channel.fetchWebhooks();
    let webhook = existingWebhooks.find(webhook => webhook.name === 'UWU');

    // If a webhook with the name 'UWU' doesn't exist, create one
    if (!webhook) {
      const newWebhook = await channel.createWebhook({
        name: 'UWU',
      });
      webhook = newWebhook;
    }

    // Get the user's message
    const userMessage = args.join(' ');

    // If the user's message is blank, send an error message
    if (!userMessage) {
      return message.reply('You need to provide a message!');
    }

    // Convert the user's message to "uwu" using the owoify package
    const uwuMessage = owoify(userMessage);

    // Add stutter to the "uwu" message using the stutterify package
    const stutterMessage = stutterify(uwuMessage);

    // Create a new message to send via the webhook
    const webhookMessage = {
      username: message.author.username,
      avatarURL: message.author.avatarURL(),
      content: stutterMessage
    };

    // Delete the user's original message
    await message.delete();

    // Send the message via the webhook
    await webhook.send(webhookMessage);
  }
};
