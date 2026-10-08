const { roleMenus } = require('../lib/db');
const { renderResults } = require('../lib/poll');

async function handleRoleMenu(client, interaction) {
  const [, , roleId] = interaction.customId.split(':');

  try {
    const menu = roleMenus.byMessage(interaction.message.id);

    if (!menu || !menu.roles.includes(roleId)) {
      await interaction.reply({
        content: 'This role menu is no longer active. Ask an admin to post a new one.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const role = guild.roles.cache.get(roleId);
    const me = guild.members.me;

    if (!role) {
      await interaction.reply({ content: 'That role no longer exists.', ephemeral: true });
      return;
    }

    if (!me || role.position >= me.roles.highest.position) {
      await interaction.reply({ content: `I can't assign ${role.name}.`, ephemeral: true });
      return;
    }

    const member = interaction.member;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role);
      await interaction.reply({ content: `Removed ${role}.`, ephemeral: true });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: `Added ${role}.`, ephemeral: true });
    }
  } catch (error) {
    console.error('Role menu button failed:', error);
    await interaction.reply({ content: 'Could not update your roles.', ephemeral: true }).catch(() => {});
  }
}

async function handlePollVote(client, interaction) {
  const poll = client.polls.get(interaction.message.id);
  const choice = Number(interaction.customId.split(':')[2]);

  if (!poll) {
    await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
    return;
  }

  if (Number.isNaN(choice) || choice >= poll.options.length) {
    await interaction.reply({ content: 'That option no longer exists.', ephemeral: true });
    return;
  }

  const voterId = `${interaction.user.id}`;
  const previous = poll.votes.get(voterId);

  if (previous === choice) {
    await interaction.reply({ content: 'You already voted for that one.', ephemeral: true });
    return;
  }

  poll.votes.set(voterId, choice);

  if (previous !== undefined) {
    poll.votes.set(previous, Math.max(0, (poll.votes.get(previous) ?? 1) - 1));
  }

  poll.votes.set(choice, (poll.votes.get(choice) ?? 0) + 1);

  await interaction.update({
    embeds: [renderResults({ question: poll.question, options: poll.options, votes: poll.votes })],
    components: interaction.message.components,
  });

  await interaction
    .followUp({
      content: previous === undefined ? 'Vote recorded.' : 'Vote changed.',
      ephemeral: true,
    })
    .catch(() => {});
}

module.exports = (client) => {
  client.polls = new Map();

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    try {
      if (interaction.customId.startsWith('rolemenu:')) {
        await handleRoleMenu(client, interaction);
      } else if (interaction.customId.startsWith('poll:vote:')) {
        await handlePollVote(client, interaction);
      }
    } catch (error) {
      console.error(`Button ${interaction.customId} failed:`, error);
    }
  });
};