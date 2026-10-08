const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'invite',
	description: 'Creates an invite link to the server.',
	usage: '!invite [optional number of days]',
	cooldown: 3000,
	run: async (client, message, args) => {
		// Set default expiration time to never
		let expirationTime = 0;
		
		// Check if user specified an expiration time
		if (args[0]) {
			// Parse expiration time from arguments
			expirationTime = parseInt(args[0]);
			if (isNaN(expirationTime)) {
				// User did not provide a valid number
				return message.reply('Please provide a valid number of days.');
			}
		}

		// Create invite link with specified expiration time
		const invite = await message.channel.createInvite({
			maxAge: expirationTime * 86400, // Convert days to seconds
			maxUses: 0 // Unlimited uses
		});

		// Create and send embed message with invite link
		const embed = new EmbedBuilder()
			.setTitle('Server Invite Link')
			.setDescription(`Here's an invite link to the server: ${invite}`)
			.setColor('#eee657')
			.setTimestamp()
			.setFooter({ text: client.user.tag });

		message.reply({ embeds: [embed] });
	}
};
