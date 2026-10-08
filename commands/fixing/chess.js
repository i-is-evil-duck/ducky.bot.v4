const { ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'tictactoe',
  description: "Starts a tic-tac-toe game using voice channels.",
  cooldown: 3000,
  async run(client, message, args) {
    const vcNames = ['chess1', 'chess2', 'chess3', 'chess4', 'chess5', 'chess6', 'chess7', 'chess8', 'chess9'];
    const vcLinks = [];

    // Create the voice channels
    for (let i = 0; i < vcNames.length; i++) {
      const channel = await message.guild.channels.create({name: vcNames[i], type: ChannelType.GuildVoice});
      const invite = await channel.createInvite();
      vcLinks.push({url: invite.url, square: i});
    }

    // Create an empty board with the links to the voice channels
    const board = [
      {symbol: "⬜", link: vcLinks[0]},
      {symbol: "⬜", link: vcLinks[1]},
      {symbol: "⬜", link: vcLinks[2]},
      {symbol: "⬜", link: vcLinks[3]},
      {symbol: "⬜", link: vcLinks[4]},
      {symbol: "⬜", link: vcLinks[5]},
      {symbol: "⬜", link: vcLinks[6]},
      {symbol: "⬜", link: vcLinks[7]},
      {symbol: "⬜", link: vcLinks[8]}
    ];

    // Create the embed message with the board
    const embed = new EmbedBuilder()
      .setTitle('Tic Tac Toe')
      .setDescription(`${board[0].symbol}${board[1].symbol}${board[2].symbol}
                       ${board[3].symbol}${board[4].symbol}${board[5].symbol}
                       ${board[6].symbol}${board[7].symbol}${board[8].symbol}`)
      .setColor('#eee657')
      .setTimestamp()
      .setFooter({ text: client.user.tag });

    // Send the embed message
    const messageEmbed = await message.reply({ embeds: [embed] });

    // Listen to voice state updates to detect when a player joins a voice channel
    client.on('voiceStateUpdate', async (oldState, newState) => {
      // Check if the user is joining a new voice channel
      if (oldState.channelId !== newState.channelId) {
        // Find the voice channel in the board array
        const squareIndex = board.findIndex(square => square.link.url === newState.channel?.invite.url);

        // If the square exists and is not already taken, update the board and send a new message
        if (squareIndex >= 0 && board[squareIndex].symbol === "⬜") {
          board[squareIndex].symbol = newState.member.user.id === message.author.id ? "❌" : "⭕";
          const newEmbed = new EmbedBuilder()
            .setTitle('Tic Tac Toe')
            .setDescription(`${board[0].symbol}${board[1].symbol}${board[2].symbol}
                             ${board[3].symbol}${board[4].symbol}${board[5].symbol}
                             ${board[6].symbol}${board[7].symbol}${board[8].symbol}`)
.setColor('#eee657')
.setTimestamp()
.setFooter({ text: client.user.tag });
                // Edit the message with the updated board
      await messageEmbed.edit({ embeds: [newEmbed] });

      // Check if the game is over
      const winner = checkWinner(board);
      if (winner) {
        const winnerMessage = winner === "❌" ? `${message.author.username} wins!` : "Bot wins!";
        const gameOverEmbed = new EmbedBuilder()
          .setTitle('Game Over')
          .setDescription(`${board[0].symbol}${board[1].symbol}${board[2].symbol}
                           ${board[3].symbol}${board[4].symbol}${board[5].symbol}
                           ${board[6].symbol}${board[7].symbol}${board[8].symbol}\n\n${winnerMessage}`)
          .setColor('#eee657')
          .setTimestamp()
          .setFooter({ text: client.user.tag });

        // Send the game over message and stop listening to voice state updates
        await message.channel.send({ embeds: [gameOverEmbed] });
        client.off('voiceStateUpdate');
      }
    }
  }
});
}
};

// Checks if there is a winner or a tie
function checkWinner(board) {
const winningCombinations = [
[0, 1, 2], [3, 4, 5], [6, 7, 8], // horizontal
[0, 3, 6], [1, 4, 7], [2, 5, 8], // vertical
[0, 4, 8], [2, 4, 6] // diagonal
];

for (const combination of winningCombinations) {
const [a, b, c] = combination;
if (board[a].symbol !== "⬜" && board[a].symbol === board[b].symbol && board[b].symbol === board[c].symbol) {
return board[a].symbol;
}
}

if (board.some(square => square.symbol === "⬜")) {
return null;
} else {
return "tie";
}
}




