const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: "Shows a list commands",
    cooldown: 3000,
    run: async (client, message, args) => {
        // Create a list of available commands
        const commands = [            
{ name: "!commands", value: "List of all commands. Alt (!cmds)" },
{ name: "!moderator", value: "special moderator tools. Alt (!mod)" },
{ name: "!utils", value: "General utilities." },
{ name: "!ping", value: "Pings the bot." },
{ name: "!avatar", value: "Shows users avatar." },
{ name: "!roles", value: "Shows permissions." },
{ name: "!members", value: "Shows member count of the server." },
{ name: "!whois", value: "Info on acount. (!whois -perms)" },
{ name: "!bot-invite", value: "Generates a invite link for the bot" },
{ name: "!invite", value: "Invite link tracker." },
{ name: "!vid", value: "Shows a list of available movies." },
{ name: "!dice", value: "Role dice." },
{ name: "!uwu", value: "Makes text verry uwu." },
{ name: "!search", value: "Search internet." },
        ];

        // Create the embed message
        const embed = new EmbedBuilder()
            .setTitle('Help')
            .setDescription("A list of commands available to you:")
            .setColor('#eee657')
            .setTimestamp()
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: client.user.tag });

        // Add each command to the embed field
        embed.addFields(commands);

        // Send the embed message to the channel
        message.reply({ embeds: [embed] });
    }
};
