const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'ping',
	description: "Check bot's ping",
	cooldown: 3000,
	run: async (client, message, args) => {
		const embed = new EmbedBuilder()
		.setTitle('Pinging...')
		.setDescription(`Pong! **${client.ws.ping} ms**`)
		.setColor('#eee657')
		.setTimestamp()
		.setFooter({ text: client.user.tag })

		message.reply({ embeds: [embed] })
	}
};
