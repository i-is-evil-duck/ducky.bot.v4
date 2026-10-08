const { EmbedBuilder } = require('discord.js');
const googleIt = require('google-it');

module.exports = {
  name: 'search',
  description: 'Searches Google. Use flag with number to specify number of results',
  cooldown: 3000,
  run: async (client, message, args) => {
    // Extract the number of search results to retrieve and the query from the message arguments
    let numResults = 2;
    let query = args.join(' ');

    const match = query.match(/-(\d+)\s+(.+)/);
    if (match) {
      numResults = parseInt(match[1]) + 1;
      query = match[2];
    }

    // Limit the number of search results to a maximum of 25
    numResults = Math.min(numResults, 25);

    // Search Google for the query and retrieve the specified number of results
    const results = await googleIt({ query: query, limit: numResults });

    // Create a new EmbedBuilder object and set its properties
    const embed = new EmbedBuilder()
      .setTitle(`Search Results for "${query}"`)
      .setColor('#eee657')
      .setTimestamp()
      .setFooter({ text: client.user.tag });

    // Add a field for each search result to the embed
    results.forEach((result) => {
      const content = `[${result.snippet.substr(0, 100)}...](${result.link})`;
      embed.addFields({ name: result.title, value: content });
    });

    // Send the embed with the search results
    message.reply({ embeds: [embed] });
  },
};
