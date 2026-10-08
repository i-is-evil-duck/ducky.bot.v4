const { WebhookClient } = require('discord.js');

module.exports = {
  name: 'spoiled-msg',
  description: 'sents text with spoilers',
  run: async (client, message, args) => {
    const channel = message.channel;

    // Check if a webhook with the name 'spoiler-bot' already exists
    const existingWebhooks = await channel.fetchWebhooks();
    let webhook = existingWebhooks.find(webhook => webhook.name === 'spoiler-bot');

    // If a webhook with the name 'spoiler-bot' doesn't exist, create one
    if (!webhook) {
      const newWebhook = await channel.createWebhook({
        name: 'spoiler-bot',
      });
      webhook = newWebhook;
    }

    // Join the args array and split the resulting string into an array of individual characters
    const messageText = args.join(' ');
    const messageCharacters = messageText.split('');

    // Construct the content of the webhook message by wrapping each character in spoiler tags
    const webhookMessageContent = messageCharacters.map(char => `||${char}||`).join('');

    // Create a new message to send via the webhook
    const webhookMessage = {
      username: message.author.username,
      avatarURL: message.author.avatarURL(),
      content: webhookMessageContent
    };

    // Delete the user's original message
    await message.delete();

    // Send the message via the webhook
    await webhook.send(webhookMessage);
  }
};
