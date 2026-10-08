const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'avatar',
    description: 'Displays the user\'s avatar',
    cooldown: 3000,
    run: async (client, message, args) => {
        // Get the user from the command argument or the message author
        const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;

        // Get the user's avatar URL
        const avatarURL = user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });

        // Create a new embed message with the user's avatar
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatarURL)
            .setColor('#eee657')
            .setTimestamp()
            .setFooter({ text: client.user.tag });

        // Send the embed message as a reply to the user's message
        message.reply({ embeds: [embed] });
    }
};
