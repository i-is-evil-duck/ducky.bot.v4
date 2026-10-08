const fs = require('fs');
const path = require('path');

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { truncate } = require('../../lib/helpers');
const { INVISIBLE_PATTERN } = require('../../lib/invisible');

function loadList() {
  const file = process.env.VIDEO_LIST
    ? path.resolve(process.env.VIDEO_LIST)
    : path.join(__dirname, '..', '..', 'assets', 'videos.txt');

  if (!fs.existsSync(file)) return { entries: [], file };

  const entries = fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, url] = line.split(';');
      return { name: (name ?? '').trim(), url: (url ?? '').trim() };
    })
    .filter((entry) => entry.name && entry.url);

  return { entries, file };
}

const MAINTENANCE = true;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vid')
    .setDescription('Looks up a video from the local list')
    .addSubcommand((sub) => sub.setName('list').setDescription('Show every video'))
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Send the link for one video')
        .addStringOption((opt) =>
          opt
            .setName('video')
            .setDescription('The video name')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  cooldown: 5000,

  async run(client, interaction, args) {
    if (MAINTENANCE) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Under maintenance')
            .setDescription(
              'The video list is being rebuilt for the new slash command setup, so lookups and the list are offline for now. Check back shortly.'
            )
            .setFooter({ text: client.user.tag })
            .setTimestamp(),
        ],
      });
      return;
    }

    const { entries, file } = loadList();

    if (entries.length === 0) {
      await interaction.reply({
        content: `No video list found at \`${file}\`. Add lines of \`name;url\`.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'list') {
      const embed = new EmbedBuilder()
        .setColor('#eee657')
        .setTitle(`Videos (${entries.length})`)
        .setDescription(truncate(entries.map((entry, index) => `${index + 1}. ${entry.name}`).join('\n'), 4090))
        .setFooter({ text: client.user.tag })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const query = interaction.options.getString('video');
    const match = entries.find((entry) => entry.name.toLowerCase() === query.toLowerCase());

    if (!match) {
      await interaction.reply({ content: `No video called \`${query}\`. Try \`/vid list\`.`, ephemeral: true });
      return;
    }

    await interaction.reply(`${INVISIBLE_PATTERN} ${match.url}`);
  },

  async autocomplete(interaction) {
    if (MAINTENANCE) {
      await interaction.respond([]);
      return;
    }

    if (interaction.options.getFocused(true).name !== 'video') {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().toLowerCase();
    const { entries } = loadList();

    await interaction.respond(
      entries
        .filter((entry) => entry.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((entry) => ({ name: truncate(entry.name, 100), value: entry.name }))
    );
  },
};