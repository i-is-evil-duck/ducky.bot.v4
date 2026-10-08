const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

require('dotenv').config();

const MODEL_ID = '8b1b897c-d66d-45a6-b8d7-8e32421d02cf';
const BASE_URL = `https://api.tryleap.ai/api/v1/images/models/${MODEL_ID}`;
const POLL_INTERVAL = 10_000;
const MAX_POLLS = 18;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gen')
    .setDescription('Generates an image from a prompt')
    .addStringOption((opt) =>
      opt.setName('prompt').setDescription('What should the image show?').setRequired(true).setMaxLength(500)
    ),

  cooldown: 30000,

  async run(client, interaction) {
    const token = process.env.TRYLEAP_API_TOKEN;

    if (!token) {
      await interaction.reply({
        content: 'Image generation is not configured on this bot (missing TRYLEAP_API_TOKEN).',
        ephemeral: true,
      });
      return;
    }

    const prompt = interaction.options.getString('prompt');

    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };

    const pending = new EmbedBuilder()
      .setColor('#eead57')
      .setTitle('Generating image')
      .setDescription('This can take up to two minutes.')
      .setFooter({ text: client.user.tag });

    await interaction.reply({ embeds: [pending] });

    try {
      const response = await fetch(`${BASE_URL}/inferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          negativePrompt: 'asymmetric, watermarks',
          steps: 50,
          width: 512,
          height: 512,
          numberOfImages: 1,
          promptStrength: 7,
          seed: Math.floor(Math.random() * 10_000_000),
          enhancePrompt: false,
          upscaleBy: 'x1',
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const { id } = await response.json();

      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

        const statusResponse = await fetch(`${BASE_URL}/inferences/${id}`, { headers });

        if (!statusResponse.ok) {
          throw new Error(`API returned ${statusResponse.status}`);
        }

        const data = await statusResponse.json();

        if (data.state === 'failed' || data.state === 'cancelled') {
          throw new Error(`Generation ${data.state}`);
        }

        if (data.state === 'finished') {
          const imageUrl = data.images?.[0]?.uri;

          if (!imageUrl) throw new Error('API returned no image URL');

          const finished = new EmbedBuilder()
            .setColor('#eee657')
            .setTitle('Generated image')
            .setDescription(`Prompt: ${prompt}`)
            .setImage(imageUrl)
            .setFooter({ text: client.user.tag })
            .setTimestamp();

          await interaction.editReply({ embeds: [finished] });
          return;
        }
      }

      throw new Error('Generation timed out');
    } catch (error) {
      console.error('Image generation failed:', error);

      const failed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Generation failed')
        .setDescription(error.message);

      await interaction.editReply({ embeds: [failed] }).catch(() => {});
    }
  },
};