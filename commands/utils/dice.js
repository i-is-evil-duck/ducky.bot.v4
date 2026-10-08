const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'dice',
    description: 'Rolls a dice and returns a random number between 1 and 6',
    cooldown: 3000,
    run: async (client, message, args) => {
        const randomNum = Math.floor(Math.random() * 6) + 1; // Generates a random number between 1 and 6
        const embed = new EmbedBuilder()
            .setTitle('Dice Roll')
            .setDescription(`You rolled a ${randomNum}! 🎲`)
            .setColor('#eee657')
            .setTimestamp()
            .setFooter({ text: client.user.tag });
        message.reply({ embeds: [embed] });
    },
};
