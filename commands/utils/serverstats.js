const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { verifications } = require('../../lib/db');
const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Detailed statistics about this server')
    .addSubcommand((sub) => sub.setName('overview').setDescription('Members, channels and roles'))
    .addSubcommand((sub) => sub.setName('channels').setDescription('Channel breakdown by type'))
    .addSubcommand((sub) =>
      sub
        .setName('verifications')
        .setDescription('Recent verifications recorded by this bot')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('How many recent verifications to show')
            .setMinValue(1)
            .setMaxValue(25)
        )
    ),

  guildOnly: true,
  cooldown: 5000,

  async run(client, interaction) {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'channels') {
      const counts = guild.channels.cache.reduce((acc, channel) => {
        acc[channel.type] = (acc[channel.type] ?? 0) + 1;
        return acc;
      }, {});

      const labels = {
        0: 'Text',
        2: 'Voice',
        4: 'Category',
        5: 'Announcement',
        13: 'Stage',
        15: 'Forum',
      };

      const fields = Object.entries(counts)
        .map(([type, count]) => ({ name: labels[type] ?? `Type ${type}`, value: String(count), inline: true }))
        .slice(0, 25);

      if (fields.length === 0) {
        await interaction.reply({ content: 'No channels found.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Channels in ${guild.name}`)
        .addFields(fields)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === 'verifications') {
      const limit = interaction.options.getInteger('limit') ?? 10;
      const rows = verifications.recent(guild.id, limit);

      if (rows.length === 0) {
        await interaction.reply({ content: 'No verifications have been recorded yet.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`Recent verifications (${verifications.count(guild.id)} total)`)
        .setDescription(
          rows
            .map(
              (row) =>
                `• <@${row.user_id}> — **${row.full_name}** (#${row.student_number}, grade ${row.grade}${
                  row.team_id ? `, team ${row.team_id}` : ''
                })`
            )
            .join('\n')
            .slice(0, 4000)
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const members = await guild.members.fetch({ limit: 0 }).catch(() => null);
    const total = guild.memberCount ?? guild.members.cache.size;
    const online = members
      ? members.filter((member) => member.presence?.status !== 'offline').size
      : guild.members.cache.filter((member) => member.presence?.status !== 'offline').size;

    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 512 }) ?? null)
      .addFields(
        { name: 'Members', value: total.toLocaleString(), inline: true },
        { name: 'Online', value: online.toLocaleString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toLocaleString(), inline: true },
        { name: 'Channels', value: guild.channels.cache.size.toLocaleString(), inline: true },
        { name: 'Emoji', value: guild.emojis.cache.size.toLocaleString(), inline: true },
        { name: 'Stickers', value: guild.stickers.cache.size.toLocaleString(), inline: true },
        { name: 'Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Boost tier', value: `Tier ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`, inline: true },
        { name: 'ID', value: truncate(guild.id, 64), inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};