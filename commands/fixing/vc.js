const { ChannelType, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Creates a temporary voice channel and posts its invite')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Channel name').setMaxLength(80)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('How many people can join')
        .setMinValue(0)
        .setMaxValue(99)
    ),

  guildOnly: true,
  userPerms: ['ManageChannels'],
  botPerms: ['ManageChannels'],
  cooldown: 10000,

  async run(client, interaction) {
    const name = interaction.options.getString('name') ?? `vc-${interaction.user.username}`;
    const limit = interaction.options.getInteger('limit') ?? 0;

    const channel = await interaction.guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      userLimit: limit,
      reason: `Created by ${interaction.user.tag}`,
    });

    const invite = await channel.createInvite();

    await interaction.reply({
      content: `Created <#${channel.id}> — invite: ${invite.url}`,
      ephemeral: true,
    });
  },
};