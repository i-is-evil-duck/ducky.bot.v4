const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'cat',
	description: "Displays a random cat image",
	cooldown: 3000,
	run: async (client, message, args) => {
		// Get a list of files in the ./programs/cats/ directory
		const files = fs.readdirSync('./programs/cats/');

		// Select a random file from the list
		const randomFile = files[Math.floor(Math.random() * files.length)];

		// Create a new EmbedBuilder object and set its properties
		const embed = new EmbedBuilder()
			.setTitle('Random Cat')
			.setColor('#eee657')
			.setTimestamp()
			.setFooter({ text: client.user.tag })
			.setImage(`attachment://${randomFile}`);

		// Send the embed with the selected image as an attachment
		message.reply({
			embeds: [embed],
			files: [{
				attachment: `./programs/cats/${randomFile}`,
				name: randomFile
			}],
		});
	},
};
