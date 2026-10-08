const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Creates an invite link to this server')
    .addIntegerOption((opt) =>
      opt
        .setName('days')
        .setDescription('How many days the invite should live')
        .setMinValue(0)
        .setMaxValue(7)
    ),

  guildOnly: true,
  userPerms: ['CreateInstantInvite'],
  cooldown: 10000,

  async run(client, interaction) {
    const days = interaction.options.getInteger('days') ?? 0;

    let invite;

    try {
      invite = await interaction.channel.createInvite({
        maxAge: days === 0 ? 0 : days * 86_400,
        maxUses: 0,
      });
    } catch (error) {
      await interaction.reply({
        content: `I couldn't create an invite here: ${error.message}`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Server invite')
      .setDescription(invite.code ? `https://discord.gg/${invite.code}` : String(invite))
      .setFooter({
        text: days === 0 ? 'Never expires' : `Expires in ${days} day${days === 1 ? '' : 's'}`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};