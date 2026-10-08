const { ChannelType, EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const WIN_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const EMPTY = '⬜';

function renderBoard(board) {
  return [
    board.slice(0, 3).join(''),
    board.slice(3, 6).join(''),
    board.slice(6, 9).join(''),
  ].join('\n');
}

function evaluate(board) {
  for (const [a, b, c] of WIN_COMBINATIONS) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return { state: 'won', symbol: board[a] };
    }
  }

  return { state: board.includes(EMPTY) ? 'ongoing' : 'tie' };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Start a tic-tac-toe game played by joining voice channels')
    .addBooleanOption((opt) =>
      opt.setName('cleanup').setDescription('Delete the voice channels when the game ends')
    ),

  guildOnly: true,
  userPerms: ['ManageChannels'],
  botPerms: ['ManageChannels', 'MoveMembers'],
  cooldown: 10000,

  async run(client, interaction) {
    const guild = interaction.guild;
    const cleanup = interaction.options.getBoolean('cleanup') ?? true;

    const me = guild.members.me;

    if (!me?.permissions.has('MoveMembers')) {
      await interaction.reply({
        content: 'I need the **Move Members** permission to drag players between channels.',
        ephemeral: true,
      });
      return;
    }

    const created = [];

    try {
      for (let i = 0; i < 9; i++) {
        created.push(
          await guild.channels.create({
            name: `ttt-${i + 1}`,
            type: ChannelType.GuildVoice,
            reason: `Tic-tac-toe game by ${interaction.user.tag}`,
          })
        );
      }
    } catch (error) {
      await Promise.all(created.map((channel) => channel.delete().catch(() => {})));
      await interaction.reply({ content: `Could not create the channels: ${error.message}`, ephemeral: true });
      return;
    }

    const board = new Array(9).fill(EMPTY);
    const channelIdToSquare = new Map(created.map((channel, index) => [channel.id, index]));

    const makeEmbed = (title, description) =>
      new EmbedBuilder()
        .setColor('#eee657')
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `Game started by ${interaction.user.tag}` })
        .setTimestamp();

    const status = await interaction.reply({
      embeds: [
        makeEmbed(
          'Tic Tac Toe',
          `${renderBoard(board)}\n\n${interaction.user.username} is ❌, everyone else is ⭕.\nJoin a channel to claim a square.`
        ),
      ],
      fetchReply: true,
    });

    let finished = false;

    const listener = async (oldState, newState) => {
      if (finished) return;
      if (newState.guildId !== guild.id) return;
      if (oldState.channelId === newState.channelId) return;

      const square = channelIdToSquare.get(newState.channelId);
      if (square === undefined) return;
      if (board[square] !== EMPTY) return;
      if (!newState.member) return;

      board[square] = newState.member.id === interaction.user.id ? '❌' : '⭕';

      const result = evaluate(board);

      if (result.state === 'ongoing') {
        await status.edit({
          embeds: [makeEmbed('Tic Tac Toe', `${renderBoard(board)}\n\nJoin a channel to claim a square.`)],
        }).catch(() => {});
        return;
      }

      finished = true;
      client.removeListener('voiceStateUpdate', listener);

      const outcome =
        result.state === 'tie'
          ? 'It is a tie!'
          : result.symbol === '❌'
            ? `${interaction.user.username} wins!`
            : 'The other player wins!';

      await status
        .edit({ embeds: [makeEmbed('Game over', `${renderBoard(board)}\n\n${outcome}`)] })
        .catch(() => {});

      if (cleanup) {
        await Promise.all(created.map((channel) => channel.delete().catch(() => {})));
      }
    };

    client.on('voiceStateUpdate', listener);

    setTimeout(() => {
      if (finished) return;
      finished = true;
      client.removeListener('voiceStateUpdate', listener);

      status
        .edit({
          embeds: [
            makeEmbed(
              'Game cancelled',
              'Nobody moved in 30 minutes, so the game was cancelled and the channels were left in place.'
            ),
          ],
        })
        .catch(() => {});
    }, 30 * 60 * 1000).unref?.();
  },
};