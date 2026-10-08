const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { roleMenus } = require('../../lib/db');
const { truncate } = require('../../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Self-assign roles, or publish a role menu for your server')
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Add or remove one of your own roles')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('The role to add or remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Publish a clickable role menu in a channel')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Heading shown above the buttons').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Where to post the menu')
            .addChannelTypes(0, 5)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName('role-1').setDescription('Role to toggle').setRequired(true)
        )
        .addRoleOption((opt) => opt.setName('role-2').setDescription('Role to toggle'))
        .addRoleOption((opt) => opt.setName('role-3').setDescription('Role to toggle'))
        .addRoleOption((opt) => opt.setName('role-4').setDescription('Role to toggle'))
        .addRoleOption((opt) => opt.setName('role-5').setDescription('Role to toggle'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List the role menus this bot has published')
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a published role menu')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Menu ID from /rolemenu list').setMinValue(1).setRequired(true)
        )
    ),

  guildOnly: true,
  cooldown: 5000,
  userPerms: ['ManageRoles'],
  botPerms: ['ManageRoles'],

  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'toggle') {
      const role = interaction.options.getRole('role');
      const me = guild.members.me;

      if (role.id === guild.id) {
        await interaction.reply({ content: 'You cannot assign the @everyone role.', ephemeral: true });
        return;
      }

      if (role.position >= (me?.roles.highest.position ?? 0)) {
        await interaction.reply({
          content: `I can't assign ${role.name} — it is above my highest role.`,
          ephemeral: true,
        });
        return;
      }

      if (role.managed) {
        await interaction.reply({
          content: `${role.name} is managed by an integration, so it cannot be self-assigned.`,
          ephemeral: true,
        });
        return;
      }

      const member = interaction.member;

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await interaction.reply({ content: `Removed ${role}.`, ephemeral: true });
      } else {
        await member.roles.add(role);
        await interaction.reply({ content: `Added ${role}.`, ephemeral: true });
      }

      return;
    }

    if (subcommand === 'list') {
      const menus = roleMenus.forGuild(guild.id);

      if (menus.length === 0) {
        await interaction.reply({ content: 'No role menus have been published here.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Role menus (${menus.length})`)
        .setDescription(
          menus
            .map((menu) => `**#${menu.id}** — <#${menu.channel_id}> — ${truncate(menu.title, 60)}`)
            .join('\n')
        )
        .setFooter({ text: client.user.tag });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === 'delete') {
      const id = interaction.options.getInteger('id');

      if (!roleMenus.remove(id)) {
        await interaction.reply({ content: `No role menu with ID **#${id}**.`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `Deleted role menu **#${id}**. The old message stays, but its buttons now do nothing.`, ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');

    if (!channel?.isTextBased()) {
      await interaction.reply({ content: 'That channel cannot receive messages.', ephemeral: true });
      return;
    }

    const roles = ['role-1', 'role-2', 'role-3', 'role-4', 'role-5']
      .map((name) => interaction.options.getRole(name))
      .filter(Boolean);

    if (roles.length === 0) {
      await interaction.reply({ content: 'Provide at least one role.', ephemeral: true });
      return;
    }

    const me = guild.members.me;
    const usable = roles.filter((role) => !role.managed && role.id !== guild.id && role.position < (me?.roles.highest.position ?? 0));

    if (usable.length === 0) {
      await interaction.reply({
        content: 'None of those roles can be assigned by me. Roles must be below my highest role and not integration-managed.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(truncate(title, 256))
      .setDescription('Click a button to toggle the role. You can press one more time to remove it.')
      .setTimestamp();

    const rows = [];
    let row = new ActionRowBuilder();

    for (const [index, role] of usable.entries()) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`rolemenu:${index}:${role.id}`)
          .setLabel(truncate(role.name, 80))
          .setStyle(ButtonStyle.Secondary)
      );

      if (row.components.length === 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
    }

    if (row.components.length > 0) rows.push(row);

    const sent = await channel.send({ embeds: [embed], components: rows });

    const menuId = roleMenus.create({
      guildId: guild.id,
      channelId: channel.id,
      messageId: sent.id,
      title,
      roles: usable.map((role) => role.id),
      createdBy: interaction.user.id,
    });

    await interaction.reply({
      content: `Role menu **#${menuId}** posted in <#${channel.id}> with ${usable.length} role(s).`,
      ephemeral: true,
    });
  },
};