const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    name: 'moderator',
    description: "List of moderator commands",
    cooldown: 3000,
    userPerms: ['Administrator'],
	  botPerms: ['Administrator'],
    run: async (client, message, args) => {
        // Create a list of available commands
        const commands = [            
{ name: "!moderator", value: "Shows a list of available moderator commands. (!del)or(!clear)" },

//Delete ,(!delete 10). Or until mesage-ID (!delete until 'put mesage-ID here') Or between two messages (!delete between 'first-msgID' 'second-msgID'
{ name: "!delete", value: "Deletes specified ammount of mesages. Alternative (!del)." },
{ name: "!web", value: "send web hook. -n <num> #chanel message" },
{ name: "!verify", value: "Makes an verify embed"},         
           { name: "!chmute", value: " Chanel mute."},         
{ name: "!chunmute", value: "Chanel unmute." }
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
