const { ChannelType } = require('discord.js');

module.exports = {
  name: 'vc',
  description: 'Creates a new voice channel named "chess1" and sends the invite link.',
  run: async (client, message, args) => {
    // Create the voice channel
     const channel = await message.guild.channels.create({name: 'chess1', type: ChannelType.GuildVoice});

    // Generate the invite link
    const invite = await channel.createInvite();

    // Send the invite link to the text channel
    message.channel.send(`Here's the invite link for the new voice channel: ${invite.url}`);
  }
};

