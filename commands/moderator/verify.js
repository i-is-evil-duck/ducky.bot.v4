const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { verifications } = require('../../lib/db');
const { getSettings, saveSettings, canManageNicknames } = require('../../lib/verify');
const { truncate } = require('../../lib/helpers');

const BUTTON_ID = 'verify:start';

const DEFAULT_INSTRUCTIONS =
  'Press the button below, fill in your details, and you will be given your roles automatically.';

function promptEmbed(config) {
  return new EmbedBuilder()
    .setColor('#eee657')
    .setTitle('Student verification')
    .setDescription(
      truncate(
        config.instructions || DEFAULT_INSTRUCTIONS,
        2000
      )
    )
    .addFields(
      {
        name: 'What you will be asked for',
        value: 'Your name, student number, team (optional) and grade.',
        inline: false,
      },
      {
        name: 'What you get',
        value: [
          `The \`${config.verifiedRoleName}\` role`,
          config.giveGradeRole ? `A \`${config.gradeRolePrefix} <grade>\` role` : null,
          config.giveTeamRole ? `A \`${config.teamRolePrefix} <team>\` role` : null,
          config.setNickname ? 'Your nickname set to your name' : null,
        ]
          .filter(Boolean)
          .join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: 'One submission per person.' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Student verification: collects details, sets nicknames and grants roles')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configure verification, then post the prompt')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Where the prompt and submissions are posted')
            .addChannelTypes(0, 5)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('verified-role')
            .setDescription('Name of the role everyone gets')
            .setMaxLength(100)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('grade-prefix')
            .setDescription('Role name prefix for grades, e.g. "grade" makes "grade 10"')
            .setMaxLength(50)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('team-prefix')
            .setDescription('Role name prefix for teams, e.g. "team" makes "team 4"')
            .setMaxLength(50)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName('nickname').setDescription('Set each member nickname to their name')
        )
        .addBooleanOption((opt) =>
          opt.setName('grade-roles').setDescription('Grant a grade role')
        )
        .addBooleanOption((opt) =>
          opt.setName('team-roles').setDescription('Grant a team role when supplied')
        )
        .addStringOption((opt) =>
          opt
            .setName('instructions')
            .setDescription('Custom text shown on the prompt')
            .setMaxLength(1500)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName('post').setDescription('Post the verification prompt'))
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Show the current verification settings and totals')
    ),

  guildOnly: true,
  userPerms: ['ManageRoles'],
  botPerms: ['ManageRoles'],
  cooldown: 5000,

  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');

      if (!channel?.isTextBased()) {
        await interaction.reply({ content: 'That channel cannot receive messages.', ephemeral: true });
        return;
      }

      const patch = { verifyChannelId: channel.id };

      const verifiedRole = interaction.options.getString('verified-role');
      if (verifiedRole) patch.verifiedRoleName = verifiedRole.trim();

      const gradePrefix = interaction.options.getString('grade-prefix');
      if (gradePrefix) patch.gradeRolePrefix = gradePrefix.trim();

      const teamPrefix = interaction.options.getString('team-prefix');
      if (teamPrefix) patch.teamRolePrefix = teamPrefix.trim();

      const nickname = interaction.options.getBoolean('nickname');
      if (nickname !== null) patch.setNickname = nickname;

      const gradeRoles = interaction.options.getBoolean('grade-roles');
      if (gradeRoles !== null) patch.giveGradeRole = gradeRoles;

      const teamRoles = interaction.options.getBoolean('team-roles');
      if (teamRoles !== null) patch.giveTeamRole = teamRoles;

      const instructions = interaction.options.getString('instructions');
      if (instructions) patch.instructions = instructions.trim();

      const config = saveSettings(guild.id, patch);

      const warnings = [];

      if (config.setNickname && !canManageNicknames(guild)) {
        warnings.push('I am missing the **Manage Nicknames** permission, so nicknames will not change.');
      }

      const sent = await channel.send({
        embeds: [promptEmbed(config)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(BUTTON_ID)
              .setLabel('Begin verification')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(warnings.length ? '#FFA500' : '#00FF00')
            .setTitle('Verification configured')
            .setDescription(
              [
                `Prompt posted in <#${channel.id}> (message ${sent.id}).`,
                `Verified role: \`${config.verifiedRoleName}\``,
                config.giveGradeRole ? `Grade roles: \`${config.gradeRolePrefix} <grade>\`` : 'Grade roles: off',
                config.giveTeamRole ? `Team roles: \`${config.teamRolePrefix} <team>\`` : 'Team roles: off',
                `Nicknames: ${config.setNickname ? 'on' : 'off'}`,
                ...warnings,
              ].join('\n')
            )
            .setFooter({ text: `Use /verify post to post it again · ${client.user.tag}` }),
        ],
        ephemeral: true,
      });

      return;
    }

    const config = getSettings(guild.id);

    if (subcommand === 'post') {
      const channel = config.verifyChannelId
        ? guild.channels.cache.get(config.verifyChannelId)
        : null;

      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: 'No verification channel is configured. Run `/verify setup` first.',
          ephemeral: true,
        });
        return;
      }

      await channel.send({
        embeds: [promptEmbed(config)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(BUTTON_ID)
              .setLabel('Begin verification')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      });

      await interaction.reply({ content: `Posted in <#${channel.id}>.`, ephemeral: true });
      return;
    }

    const total = verifications.count(guild.id);
    const recent = verifications.recent(guild.id, 10);
    const channel = config.verifyChannelId ? `<#${config.verifyChannelId}>` : 'Not set';

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Verification status')
      .addFields(
        { name: 'Total verified', value: String(total), inline: true },
        { name: 'Channel', value: channel, inline: true },
        { name: 'Nicknames', value: config.setNickname ? 'On' : 'Off', inline: true },
        { name: 'Verified role', value: `\`${config.verifiedRoleName}\``, inline: true },
        {
          name: 'Grade roles',
          value: config.giveGradeRole ? `\`${config.gradeRolePrefix} <grade>\`` : 'Off',
          inline: true,
        },
        {
          name: 'Team roles',
          value: config.giveTeamRole ? `\`${config.teamRolePrefix} <team>\`` : 'Off',
          inline: true,
        },
        {
          name: 'Recent submissions',
          value: recent.length
            ? recent
                .map(
                  (row) =>
                    `<@${row.user_id}> — ${row.full_name} (#${row.student_number}, grade ${row.grade}${
                      row.team_id ? `, team ${row.team_id}` : ''
                    })`
                )
                .join('\n')
                .slice(0, 1020)
            : 'None yet',
          inline: false,
        }
      )
      .setFooter({ text: `${client.user.tag} · use /verify setup to change these` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};