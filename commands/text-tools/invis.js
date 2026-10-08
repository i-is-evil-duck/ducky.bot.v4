const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { INVISIBLE_PATTERN } = require('../../lib/invisible');
const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invis')
    .setDescription('Shows the code used to make messages invisible'),

  cooldown: 3000,

  async run(client, interaction) {
    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Invisible text code')
      .setDescription(truncate(`\`\`\`${INVISIBLE_PATTERN}\`\`\``, 4090))
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};