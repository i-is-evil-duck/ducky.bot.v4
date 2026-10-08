const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const config = require('../../config.json');
const { verifyLog } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Posts a verification prompt that grants a role on reaction')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('The role to grant. Defaults to the admin role').setRequired(false)
    ),

  guildOnly: true,
  userPerms: ['ManageRoles'],
  botPerms: ['ManageRoles'],
  cooldown: 10000,

  async run(client, interaction) {
    const guild = interaction.guild;

    const role =
      interaction.options.getRole('role') ??
      guild.roles.cache.find(
        (entry) => entry.name.toLowerCase() === (config.adminRoleName ?? 'admin').toLowerCase()
      ) ??
      null;

    if (!role) {
      await interaction.reply({
        content: 'Pick a role to grant, or create a role matching the configured admin role name.',
        ephemeral: true,
      });
      return;
    }

    const me = guild.members.me;

    if (role.position >= (me?.roles.highest.position ?? 0)) {
      await interaction.reply({
        content: `${role.name} is above my highest role, so I cannot grant it.`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Verification')
      .setDescription(`React with ✅ to receive the ${role} role.`)
      .setFooter({ text: client.user.tag })
      .setTimestamp();

    const prompt = await interaction.channel.send({ embeds: [embed] });
    await prompt.react('✅');

    const collector = prompt.createReactionCollector({
      filter: (reaction, user) => reaction.emoji.name === '✅' && !user.bot,
      max: 200,
      time: 7 * 24 * 60 * 60 * 1000,
    });

    collector.on('collect', async (reaction, user) => {
      try {
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (!member) return;

        if (member.roles.cache.has(role.id)) {
          await reaction.user.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#eee657')
                .setDescription(`You already have ${role}.`),
            ],
          });
          return;
        }

        await member.roles.add(role);

        verifyLog.add({
          guildId: guild.id,
          userId: user.id,
          sourceMessageId: prompt.id,
        });

        await user
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Verified')
                .setDescription(`You have been given the ${role} role.`),
            ],
          })
          .catch(() => {});
      } catch (error) {
        console.error('Verification failed:', error);
      }
    });

    collector.on('end', () => {
      prompt
        .edit({ embeds: [embed.setFooter({ text: 'This verification prompt has closed.' })] })
        .catch(() => {});
    });

    await interaction.reply({
      content: `Verification prompt posted. ${role} will be granted to anyone who reacts.`,
      ephemeral: true,
    });
  },
};