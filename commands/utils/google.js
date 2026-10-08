const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const googleIt = require('google-it');

const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches Google')
    .addStringOption((opt) => opt.setName('query').setDescription('What to search for').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('results')
        .setDescription('How many results to show')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  cooldown: 5000,

  async run(client, interaction) {
    const query = interaction.options.getString('query');
    const limit = interaction.options.getInteger('results') ?? 3;

    let results;

    try {
      results = await googleIt({ query, limit });
    } catch (error) {
      await interaction.reply({ content: `Google search failed: ${error.message}`, ephemeral: true });
      return;
    }

    if (!results.length) {
      await interaction.reply({ content: `No results for \`${query}\`.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(truncate(`Results for "${query}"`, 256))
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    for (const result of results) {
      embed.addFields({
        name: truncate(result.title, 256),
        value: truncate(result.snippet, 200) + `\n[Link](${result.link})`,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};