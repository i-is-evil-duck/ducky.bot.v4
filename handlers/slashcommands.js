const { Collection, MessageFlags, PermissionsBitField } = require('discord.js');

const { collectCommands } = require('../lib/commands');
const { getArgs } = require('../lib/helpers');

const hasAll = (permissions, required) =>
  required.filter((perm) => !permissions.has(PermissionsBitField.resolve(perm)));

module.exports = (client) => {
  client.slashCommands = new Collection();
  client.cooldowns = new Collection();

  for (const command of collectCommands()) {
    client.slashCommands.set(command.data.name, command);
    console.log(`✅ /${command.data.name}`);
  }

  console.log(`Loaded ${client.slashCommands.size} slash commands.`);

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
      const autocompleteCommand = client.slashCommands.get(interaction.commandName);
      if (autocompleteCommand?.autocomplete) {
        try {
          await autocompleteCommand.autocomplete(interaction);
        } catch (error) {
          console.error(`Autocomplete failed for /${interaction.commandName}:`, error);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
      if (command.guildOnly && !interaction.inGuild()) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (command.userPerms?.length) {
        const memberPerms = interaction.inGuild() ? interaction.member.permissions : null;
        const missing = memberPerms ? hasAll(memberPerms, command.userPerms) : command.userPerms;

        if (missing.length) {
          await interaction.reply({
            content: `You need the following permissions: ${missing.join(', ')}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (command.botPerms?.length) {
        const me = interaction.guild.members.me;
        const missing = me ? hasAll(me.permissions, command.botPerms) : command.botPerms;
        if (missing.length) {
          await interaction.reply({
            content: `I'm missing the following permissions: ${missing.join(', ')}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      const key = `${interaction.user.id}:${command.data.name}`;
      const now = Date.now();
      const expiresAt = client.cooldowns.get(key) ?? 0;

      if (now < expiresAt) {
        const seconds = Math.ceil((expiresAt - now) / 1000);
        await interaction.reply({
          content: `Please wait ${seconds} more second${seconds === 1 ? '' : 's'} before using \`/${command.data.name}\` again.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      client.cooldowns.set(key, now + command.cooldown);

      await command.run(client, interaction, getArgs(interaction));
    } catch (error) {
      console.error(`Error in /${interaction.commandName}:`, error);

      const payload = {
        content: 'Something went wrong while running that command. The error has been logged.',
        flags: MessageFlags.Ephemeral,
      };

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch {
        console.error('Could not deliver the error response.');
      }
    }
  });
};