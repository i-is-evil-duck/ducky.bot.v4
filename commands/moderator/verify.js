const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'verify',
    description: 'make a embed with a verify reaction. Alt(!verify-thread)',
    usage: 'verify <@role>',
    cooldown: 3000,
    run: async (client, message, args) => {
        // Check if user is a moderator
        if (!message.member.permissions.has('MANAGE_ROLES')) {
            return message.reply('You do not have permission to use this command.');
        }

        // Get the role to assign to verified users
        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply('Usage ```!verify @verified```');
        }

        // Create the verification embed message
        const embed = new EmbedBuilder()
            .setTitle('Verification')
            .setDescription(`React to this message with ✅ to verify yourself and get the ${role} role.`)
            .setColor('#eee657')
            .setTimestamp();

        // Send the verification embed message and add the reaction
        const verificationMessage = await message.channel.send({ embeds: [embed] });
        verificationMessage.react('✅');

        // Create a filter function to only accept reactions from the user who triggered the command
        const filter = (reaction, user) => user.id === message.author.id && reaction.emoji.name === '✅';

        // Create a reaction collector to listen for the ✅ reaction
        const collector = verificationMessage.createReactionCollector({ filter });

        // Handle the ✅ reaction
        collector.on('collect', async (reaction, user) => {
            // Remove the reaction from the message
            reaction.users.remove(user);

            // Give the user the verified role
            try {
                await message.member.roles.add(role);
                const replyEmbed = new EmbedBuilder()
                    .setTitle('Verification')
                    .setDescription(`You have been successfully verified and given the ${role} role.`)
                    .setColor('#00FF00')
                    .setTimestamp();
                await message.author.send({ embeds: [replyEmbed] });
            } catch (err) {
                console.error(err);
                message.reply('An error occurred while trying to assign the role.');
            }

            // Stop listening for reactions
            collector.stop();
        });
    }
};
