const fs = require('fs');
const { prefix } = require('../config.json');

module.exports = (client) => {
  const commandFolders = fs.readdirSync('./commands');

  for (const folder of commandFolders) {
    const commandFiles = fs
      .readdirSync(`./commands/${folder}`)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(`../commands/${folder}/${file}`);

      if (command.name && command.run) {
        client.commands.set(command.name, command);

        if (command.aliases) {
          command.aliases.forEach((alias) =>
            client.aliases.set(alias, command.name)
          );
        }

        console.log(`✅ ${command.name}`);
      } else {
        console.warn(`Invalid command file: ${file}`);
      }
    }
  }

  client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command =
      client.commands.get(commandName) ||
      client.commands.get(client.aliases.get(commandName));
    if (!command) return;

    if (command.userPerms) {
      if (!message.guild) {
        return message.reply('This command can only be used in a server.');
      }

      const authorPerms = message.member.permissions;
      const missing = command.userPerms.filter((perm) => !authorPerms.has(perm));
      if (missing.length) {
        return message.reply(`You are missing the following permissions to run this command: ${missing.join(', ')}`);
      }
    }

    try {
      await command.run(client, message, args);
    } catch (error) {
      console.error(error);
      message.reply({ content: 'There was an error trying to execute that command!', ephemeral: true });
    }
  });
};
