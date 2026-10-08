const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'hello',
	description: "says hi",
	cooldown: 3000,
	run: async (client, message, args) => {
		const embed = new EmbedBuilder()
		.setTitle('HI')
		.setDescription(`How are you?`)
		.setColor('#eee657')
		.setTimestamp()
		.setFooter({ text: client.user.tag })

		message.reply({ embeds: [embed] })
	}
};
