const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { verifications } = require('../../lib/db');
const { getSettings, saveSettings, canManageNicknames, MAX_GRADE } = require('../../lib/verify');
const { truncate } = require('../../lib/helpers');
const { mostRecentRollover, runRollover, describeRollover } = require('../../lib/rollover');
const { discoverGradeRoles, gradeSummary } = require('../../lib/grades');

const BUTTON_ID = 'verify:start';

const DEFAULT_INSTRUCTIONS = 'Please put in details';

function promptEmbed(config) {
  return new EmbedBuilder()
    .setColor('#eee657')
    .setTitle('Student verification')
    .setDescription(truncate(config.instructions || DEFAULT_INSTRUCTIONS, 2000))
    .addFields(
      { name: 'Name', value: 'Your full name', inline: false },
      { name: 'Student number', value: 'Your student number', inline: false },
      { name: 'Team letter', value: 'One letter (a-z) or SWARM', inline: false },
      { name: 'Grade', value: '8 to 12', inline: false }
    );
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
            .setDescription('Where the prompt is posted')
            .addChannelTypes(0, 5)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('log-channel')
            .setDescription('Where "New verification" notifications go. Defaults to the prompt channel')
            .addChannelTypes(0, 5)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('log-submissions')
            .setDescription('Post a summary whenever someone verifies')
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
        .addStringOption((opt) =>
          opt
            .setName('graduated-role')
            .setDescription('Role given when someone rolls past the top grade')
            .setMaxLength(100)
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
    )
    .addSubcommand((sub) =>
      sub
        .setName('rollover')
        .setDescription('Preview or run the 1 September grade rollover now')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('preview shows what would change, run applies it')
            .setRequired(true)
            .addChoices(
              { name: 'Preview (no changes)', value: 'preview' },
              { name: 'Run now', value: 'run' }
            )
        )
    ),

  guildOnly: true,
  userPerms: ['ManageRoles'],
  botPerms: ['ManageRoles'],
  cooldown: 5000,

  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'rollover') {
      const mode = interaction.options.getString('mode');
      const dryRun = mode === 'preview';

      await interaction.deferReply({ ephemeral: true });

      const results = await runRollover(client, { force: true, dryRun, guildId: guild.id });

      if (results.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('Nothing to roll over')
              .setDescription(
                'No grade roles were discovered in this server, so there is nothing to advance. Use `/verify setup` to post the verification prompt first.'
              ),
          ],
        });
        return;
      }

      const embeds = describeRollover(results, { dryRun });

      for (const [index, embed] of embeds.entries()) {
        const payload = { embeds: [embed] };

        if (index === 0) {
          await interaction.editReply(payload);
        } else {
          await interaction.followUp({ ...payload, ephemeral: true });
        }
      }

      return;
    }

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');

      if (!channel?.isTextBased()) {
        await interaction.reply({ content: 'That channel cannot receive messages.', ephemeral: true });
        return;
      }

      const patch = { verifyChannelId: channel.id };

      const logChannel = interaction.options.getChannel('log-channel');
      if (logChannel) patch.verificationLogChannelId = logChannel.id;

      const logSubmissions = interaction.options.getBoolean('log-submissions');
      if (logSubmissions !== null) patch.logSubmissions = logSubmissions;

      const verifiedRole = interaction.options.getString('verified-role');
      if (verifiedRole) patch.verifiedRoleName = verifiedRole.trim();

      const gradePrefix = interaction.options.getString('grade-prefix');
      if (gradePrefix) patch.gradeRolePrefix = gradePrefix.trim();

      const teamPrefix = interaction.options.getString('team-prefix');
      if (teamPrefix) patch.teamRolePrefix = teamPrefix.trim();

      const graduatedRole = interaction.options.getString('graduated-role');
      if (graduatedRole) patch.graduatedRoleName = graduatedRole.trim();

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
        warnings.push(
          '⚠️ I am missing the **Manage Nicknames** permission here, so nicknames will NOT change. Enable it for me in Server Settings → Roles.'
        );
      }

      const logChannelId = config.verificationLogChannelId ?? config.verifyChannelId;
      const logChannelMention = guild.channels.cache.get(logChannelId);

      if (!logChannelMention?.isTextBased()) {
        warnings.push('⚠️ The notification channel is not usable, so no "New verification" summaries will be posted.');
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
                `Notifications: ${config.logSubmissions ? `<#${logChannel}>` : 'off'}`,
                `Verified role: \`${config.verifiedRoleName}\``,
                config.giveGradeRole ? `Grade roles: \`${config.gradeRolePrefix} 8-${MAX_GRADE}\`` : 'Grade roles: off',
                config.giveGradeRole
                  ? `Grade ${MAX_GRADE} becomes \`${config.graduatedRoleName}\` on 1 September`
                  : null,
                config.giveTeamRole ? `Team roles: \`${config.teamRolePrefix} <a-z|SWARM>\`` : 'Team roles: off',
                `Nicknames: ${config.setNickname ? 'on' : 'off'}`,
                ...warnings,
              ]
                .filter(Boolean)
                .join('\n')
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
    const logChannel = config.verificationLogChannelId ?? config.verifyChannelId;
    const logChannelText = config.logSubmissions
      ? logChannel
        ? `<#${logChannel}>`
        : 'Not set'
      : 'Off';
    const rolloverRan = config.lastRollover ? `<t:${Math.floor(config.lastRollover / 1000)}:f>` : 'Never';
    const discovered = discoverGradeRoles(guild);
    const discoveredText = gradeSummary(discovered) || 'None found yet';
    const verifiedRoleFound = guild.roles.cache.some(
      (role) => role.name.toLowerCase() === String(config.verifiedRoleName).toLowerCase()
    );

    const embed = new EmbedBuilder()
      .setColor('#eee657')
      .setTitle('Verification status')
      .addFields(
        { name: 'Total verified', value: String(total), inline: true },
        { name: 'Channel', value: channel, inline: true },
        { name: 'Notifications', value: logChannelText, inline: true },
        { name: 'Nicknames', value: config.setNickname ? 'On' : 'Off', inline: true },
        {
          name: 'Nickname permission',
          value: config.setNickname ? (canManageNicknames(guild) ? 'Granted' : '⚠️ Missing') : 'Not needed',
          inline: true,
        },
        { name: 'Verified role', value: `\`${config.verifiedRoleName}\``, inline: true },
        {
          name: 'Grade roles',
          value: config.giveGradeRole ? `\`${config.gradeRolePrefix} 8-${MAX_GRADE}\`` : 'Off',
          inline: true,
        },
        {
          name: 'Team roles',
          value: config.giveTeamRole ? `\`${config.teamRolePrefix} <a-z|SWARM>\`` : 'Off',
          inline: true,
        },
        { name: 'Graduated role', value: `\`${config.graduatedRoleName}\``, inline: true },
        {
          name: 'Verified role found',
          value: verifiedRoleFound ? 'Yes' : 'No - will be created on first use',
          inline: true,
        },
        {
          name: 'Existing grade roles',
          value: truncate(discoveredText, 1020),
          inline: false,
        },
        {
          name: 'Last rollover',
          value: `${rolloverRan} · next 1 Sep · use /verify rollover preview`,
          inline: false,
        },
        {
          name: 'Recent submissions',
          value: recent.length
            ? recent
                .map(
                  (row) =>
                    `<@${row.user_id}> — ${row.full_name} (#${row.student_number}, grade ${row.grade ?? '—'}${
                      row.team_letter ? `, team ${row.team_letter}` : ''
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