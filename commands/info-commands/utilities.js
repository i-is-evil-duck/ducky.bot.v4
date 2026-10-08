const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    name: 'utils',
    description: "Shows a list of utility commands",
    cooldown: 3000,
    run: async (client, message, args) => {
        // Create a list of available commands
        const commands = [            
{ name: "!whois", value: "Info on acount. (!whois -perms)" },
{ name: "!ping", value: "Pings the bot." },
{ name: "!members", value: "Shows member count of the server." },
{ name: "!roles", value: "Shows permissions. (!roles @cool-role)" },
{ name: "!bot-info", value: "Bot info." },
{ name: "!invite", value: "Invite link utils." },
{ name: "!avatar", value: "Displays avatar of specified user." },
{ name: "!search", value: "Search the internet. (!search -5 cheese)" },
{ name: "!uwu", value: "Makes text verry uwu." },
{ name: "!spoiled-msg", value: "Makes every letter a sploier." },
{ name: "!invis-msg", value: "makes messages invis. Use (!invis) for text code" },
{ name: "!waifu", value: "Shows degeneracy." },
{ name: "!cat", value: "Shows a cat." },
{ name: "!generate", value: "Generates an image. Alt (!gen)" },
{ name: "!dice", value: "Roles a dice." },
{ name: "!count", value: "counts up to a number." },
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
