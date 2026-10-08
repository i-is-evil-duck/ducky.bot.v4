const Discord = require('discord.js');
const fs = require('fs');

module.exports = {
	name: 'verify-thread',
	description: 'Create a private thread with the user who reacted.',
	run: async (client, message, args) => {
		const reaction = '🧵'; // Emoji used to trigger the thread creation

		// Send a message with the reaction to trigger the thread creation
		const msg = await message.channel.send(`React with ${reaction} to start a private thread.`);

		// Add the reaction to the message
		await msg.react(reaction);

		// Keep track of the users who have already reacted
		const reactedUsers = new Set();

		// Create a reaction collector to listen for the user reaction
		const collector = msg.createReactionCollector({
			filter: (reaction, user) => reaction.emoji.name === '🧵' && !user.bot,
		});

		// Listen for the 'collect' event, which is emitted when a user reacts to the message
		collector.on('collect', async (reaction, user) => {
			// Check if the user has already reacted
			if (reactedUsers.has(user.id)) {
				return;
			}

			// Add the user to the set of reacted users
			reactedUsers.add(user.id);

			// Create a new thread with the user who reacted
			const thread = await message.channel.threads.create({
				name: `${user.username}'s thread`,
				autoArchiveDuration: 1440, // Set the thread to archive in 24 hours
				type: 12, // Set the thread type to GUILD_PRIVATE_THREAD
				invitable: true,
				// Add the user who reacted as a member of the thread
				// and send them a welcome message
				permissionOverwrites: [
					{
						id: user.id,
						type: 'member',
						allow: ['VIEW_CHANNEL', 'SEND_MESSAGES']
					}
				]
			});

			// Send a welcome message in the new thread
			await thread.send(`Welcome, ${user}! This is your private thread.`);
		});


		// Write the ID of the message to a file
		fs.appendFile('./programs/verify/list.txt', `${msg.id}\n`, (err) => {
			if (err) {
				console.error(err);
			}
		});
	},
};
