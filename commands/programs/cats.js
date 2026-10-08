const fs = require('fs');
const path = require('path');

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Displays a random cat image from the local library'),

  cooldown: 5000,

  async run(client, interaction) {
    await sendRandomImage(client, interaction, 'cats', 'Random cat');
  },
};

async function sendRandomImage(client, interaction, folder, title) {
  const assetsDir = process.env.ASSETS_DIR
    ? path.join(process.env.ASSETS_DIR, folder)
    : path.join(__dirname, '..', '..', 'assets', folder);

  if (!fs.existsSync(assetsDir)) {
    await interaction.reply({
      content: `No \`${folder}\` library found. Add images to \`assets/${folder}/\`.`,
      ephemeral: true,
    });
    return;
  }

  const files = fs
    .readdirSync(assetsDir)
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));

  if (files.length === 0) {
    await interaction.reply({ content: `The \`${folder}\` library is empty.`, ephemeral: true });
    return;
  }

  const file = files[Math.floor(Math.random() * files.length)];

  const embed = new EmbedBuilder()
    .setColor('#eee657')
    .setTitle(title)
    .setImage(`attachment://${file}`)
    .setFooter({ text: `${files.length} images · ${client.user.tag}` });

  await interaction.reply({
    embeds: [embed],
    files: [{ attachment: path.join(assetsDir, file), name: file }],
  });
}

module.exports.sendRandomImage = sendRandomImage;