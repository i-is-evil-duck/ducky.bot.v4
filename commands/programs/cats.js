const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const MAINTENANCE = true;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Displays a random cat image from the local library'),

  cooldown: 5000,

  async run(client, interaction) {
    if (MAINTENANCE) {
      await interaction.reply({ embeds: [maintenanceEmbed(client, 'cat pictures')] });
      return;
    }

    await sendRandomImage(client, interaction, 'cats', 'Random cat');
  },
};

function maintenanceEmbed(client, subject) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('Under maintenance')
    .setDescription(
      `\`${subject}\` are being rebuilt right now. The image library is being repackaged for the new slash command setup — check back shortly.`
    )
    .setFooter({ text: client.user.tag })
    .setTimestamp();
}

async function sendRandomImage(client, interaction, folder, title) {
  const fs = require('fs');
  const path = require('path');
  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

  const assetsDir = path.join(__dirname, '..', '..', 'assets', folder);

  if (!fs.existsSync(assetsDir)) {
    await interaction.reply({ content: `No \`${folder}\` library found.`, ephemeral: true });
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

module.exports.maintenanceEmbed = maintenanceEmbed;
module.exports.sendRandomImage = sendRandomImage;