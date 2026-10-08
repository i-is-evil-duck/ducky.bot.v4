const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { categoryTitle } = require('../../lib/commands');
const { truncate } = require('../../lib/helpers');

function summarise(command) {
  const subcommands = command.data.options?.filter(
    (option) => option.type === 1 || option.type === 2
  );

  if (subcommands?.length) {
    return subcommands.map((sub) => `\`/${command.data.name} ${sub.name}\` — ${sub.description}`);
  }

  return `\`/${command.data.name}\` — ${truncate(command.data.description, 90)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List every command the bot has registered')
    .addStringOption((opt) =>
      opt
        .setName('command')
        .setDescription('Only show one command')
        .setAutocomplete(true)
    ),

  cooldown: 5000,

  async run(client, interaction) {
    const query = interaction.options.getString('command');

    const commands = [...client.slashCommands.values()].sort((a, b) =>
      a.data.name.localeCompare(b.data.name)
    );

    if (query) {
      const found = commands.find(
        (command) => command.data.name === query.toLowerCase() || command.category === query.toLowerCase()
      );

      if (!found) {
        await interaction.reply({ content: `No command or category called \`${query}\`.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`/${found.data.name}`)
        .setDescription(found.data.description)
        .addFields(
          { name: 'Category', value: found.categoryName, inline: true },
          { name: 'Cooldown', value: `${(found.cooldown / 1000).toFixed(1)}s`, inline: true },
          { name: 'Server only', value: found.guildOnly ? 'Yes' : 'No', inline: true },
          { name: 'Your permissions', value: found.userPerms?.length ? found.userPerms.join(', ') : 'None', inline: false },
          { name: 'My permissions', value: found.botPerms?.length ? found.botPerms.join(', ') : 'None', inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const byCategory = commands.reduce((acc, command) => {
      acc[command.category] ??= [];
      acc[command.category].push(command);
      return acc;
    }, {});

    const summary = Object.entries(byCategory)
      .map(([category, list]) => `**${categoryTitle(category)}** (${list.length})\n${list.map(summarise).join('\n')}`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`${client.user.username} commands`)
      .setDescription(truncate(summary, 4090))
      .setFooter({
        text: `${commands.length} commands · ${Object.keys(byCategory).length} categories · /help command:<name>`,
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = [...interaction.client.slashCommands.values()]
      .filter(
        (command) =>
          command.data.name.includes(focused) || command.category.includes(focused)
      )
      .slice(0, 25)
      .map((command) => ({ name: `/${command.data.name}`, value: command.data.name }));

    await interaction.respond(choices);
  },
};