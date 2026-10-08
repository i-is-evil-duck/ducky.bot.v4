const { WebhookClient } = require('discord.js');

module.exports = {
  name: 'invis-msg',
  description: 'Creates invisible messages',
  run: async (client, message, args) => {
    const channel = message.channel;

    // Check if a webhook with the name 'UWU' already exists
    const existingWebhooks = await channel.fetchWebhooks();
    let webhook = existingWebhooks.find(webhook => webhook.name === 'ligma');

    // If a webhook with the name 'UWU' doesn't exist, create one
    if (!webhook) {
      const newWebhook = await channel.createWebhook({
        name: 'ligma',
      });
      webhook = newWebhook;
    }

    // Extract visible and invisible text from the args array
    const regex = /^-(.+)\s+-{1,2}(.+)$/s;
    const match = args.join(' ').match(regex);

    if (!match) {
      return message.reply("Please provide both visible and invisible text in the format `-visible text -(invisible text)`")
        .then(msg => setTimeout(() => msg.delete(), 5000))
        .catch(console.error);
    }

    const visibleText = match[1];
    const invisibleText = match[2];

		const invisiblePattern = '||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _';

    // Create a new message to send via the webhook
    const webhookMessage = {
      username: message.author.username,
      avatarURL: message.author.avatarURL(),
      content: `${visibleText} ${invisiblePattern}${invisibleText}`
    };

    // Delete the user's original message
    await message.delete();

    // Send the message via the webhook
    await webhook.send(webhookMessage);
  }
};


