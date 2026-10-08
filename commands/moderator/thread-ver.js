const { EmbedBuilder, ChannelType, OverwriteType } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: '-verify',
  description: 'Creates a verification thread for users',
  cooldown: 3000,
  run: async (client, message, args) => {
    const reaction = '✅';

    const embed = new EmbedBuilder()
      .setTitle('Verification')
      .setDescription(`React with ${reaction} to start verification.`)
      .setColor('#eee657')
      .setTimestamp();

    const msg = await message.channel.send({ embeds: [embed] });

    await msg.react(reaction);

    const reactedUsers = new Set();

    const collector = msg.createReactionCollector({
      filter: (reaction, user) => reaction.emoji.name === '✅' && !user.bot,
    });

    collector.on('collect', async (reaction, user) => {
      if (reactedUsers.has(user.id)) {
        return;
      }

      reactedUsers.add(user.id);

      const threadEmbed = new EmbedBuilder()
        .setTitle('Verification Questions')
        .setDescription(`${user}, Please fill out the following questions:`)
        .addFields(
          { name: '1. How did you join this server?', value: 'Answer here' },
          { name: '2. Are you on the Alpha Robotics team?', value: 'Answer here' },
          { name: '3. What is your name?', value: 'Answer here' },
          { name: '4. What team are you on?', value: 'Answer here' },
          { name: '5. Anything else we should know?', value: 'Answer here' },
        )
        .setColor('#eee657')
        .setTimestamp();

      // Fetch the admin role
      const adminRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'admin');

      if (!adminRole) {
        console.error('No "admin" role found; thread will be granted to the user only.');
      }

      const permissionOverwrites = [
        { id: user.id, type: OverwriteType.Member },
      ];

      if (adminRole) {
        permissionOverwrites.push({ id: adminRole.id, type: OverwriteType.Role });
      }

      const adminMention = adminRole ? ` <@&${adminRole.id}>` : '';

      // Create the thread and add permissions for the user and the admin role
      const thread = await message.channel.threads.create({
        name: `${user.username}'s thread`,
        autoArchiveDuration: 1440,
        type: ChannelType.GuildPrivateThread,
        invitable: true,
      });

      // threads.create ignores permissionOverwrites, so apply them after creation
      for (const overwrite of permissionOverwrites) {
        await thread.permissionOverwrites.edit(
          overwrite.id,
          { ViewChannel: true, SendMessages: true },
          { type: overwrite.type }
        );
      }


      const welcomeMessage = `Welcome <@${user.id}> ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _${adminMention}`;

      await thread.send(welcomeMessage);
      await thread.send({ embeds: [threadEmbed] });
    });

    const verifyDir = path.join(__dirname, '..', '..', 'data', 'verify');
    fs.mkdirSync(verifyDir, { recursive: true });
    fs.appendFile(path.join(verifyDir, 'list.txt'), `${msg.id}\n`, (err) => {
      if (err) {
        console.error(err);
      }
    });
  },
};
