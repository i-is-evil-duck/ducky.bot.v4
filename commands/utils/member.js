const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { truncate } = require('../../lib/helpers');

const STATUS_EMOJI = {
  online: '\u{1F7E2}',
  idle: '\u{1F7E1}',
  dnd: '\u{1F534}',
  offline: '\u{26AA}',
  invisible: '\u{26AA}',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Shows the member count and a breakdown by status'),

  guildOnly: true,
  cooldown: 5000,

  async run(client, interaction) {
    const members = await interaction.guild.members.fetch({ limit: 0 }).catch(() => null);
    const cache = members ?? interaction.guild.members.cache;

    const buckets = { online: [], idle: [], dnd: [], offline: [] };

    for (const member of cache.values()) {
      const status = member.presence?.status ?? 'offline';
      (buckets[status] ?? buckets.offline).push(member);
    }

    const fields = Object.entries(buckets)
      .map(([status, list]) => ({
        name: `${STATUS_EMOJI[status] ?? STATUS_EMOJI.offline} ${status[0].toUpperCase()}${status.slice(1)} (${list.length})`,
        value: truncate(
          list.length ? list.slice(0, 25).map((member) => `<@${member.id}>`).join(' ') : 'None',
          1000
        ),
        inline: false,
      }))
      .slice(0, 4);

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle(`Members of ${interaction.guild.name}`)
      .setDescription(`Total: **${interaction.guild.memberCount ?? cache.size}**`)
      .addFields(fields)
      .setFooter({ text: `Showing up to 25 names per status · ${client.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};