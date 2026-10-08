const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription("Check the bot's latency"),

  cooldown: 3000,

  async run(client, interaction) {
    const sent = await interaction.reply({
      content: 'Measuring...',
      fetchReply: true,
    });

    const roundTrip = Date.now() - sent.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Pong!')
      .addFields(
        { name: 'Round trip', value: `${roundTrip} ms`, inline: true },
        { name: 'Websocket heartbeat', value: `${Math.round(client.ws.ping)} ms`, inline: true }
      )
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};