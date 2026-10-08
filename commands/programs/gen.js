const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
  name: 'gen',
  description: '(!generate))',
  cooldown: 3000,
  async run(client, message, args) {
    const prompt = args.join(' ');
  const fetch = await import('node-fetch');

    const url = 'https://api.tryleap.ai/api/v1/images/models/8b1b897c-d66d-45a6-b8d7-8e32421d02cf/inferences';
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.TRYLEAP_API_TOKEN}`
      },
      body: JSON.stringify({
        prompt: prompt,
        negativePrompt: 'asymmetric, watermarks',
        steps: 50,
        width: 512,
        height: 512,
        numberOfImages: 1,
        promptStrength: 7,
        seed: Math.floor(Math.random() * 10000000),
        enhancePrompt: false,
        upscaleBy: 'x1'
      })
    };

    const embed = new EmbedBuilder()
      .setTitle('GENERATING IMAGE')
      .setDescription('Please wait, this can take up to 2 minutes.')
      .setColor('#eead57')
      .setTimestamp()
      .setFooter({ text: client.user.tag });

    const sentMessage = await message.channel.send({ embeds: [embed] });

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      const id = data.id;

      const checkImageUrl = `https://api.tryleap.ai/api/v1/images/models/8b1b897c-d66d-45a6-b8d7-8e32421d02cf/inferences/${id}`;
      const checkImageOptions = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${process.env.TRYLEAP_API_TOKEN}`
        }
      };

      const interval = setInterval(async () => {
        try {
          const checkImageResponse = await fetch(checkImageUrl, checkImageOptions);
          const checkImageData = await checkImageResponse.json();
          if (checkImageData.state === 'finished') {
            const imageUrl = checkImageData.images[0].uri;
            const generatedEmbed = new EmbedBuilder()
              .setTitle('GENERATED IMAGE')
              .setDescription(`[View Image](${imageUrl})`)
              .setImage(imageUrl)

              .setColor('#eee657')
              .setTimestamp()
              .setFooter({ text: client.user.tag });

            sentMessage.edit({ embeds: [generatedEmbed] });
            clearInterval(interval);
          }
        } catch (error) {
          console.error(error);
          sentMessage.edit({ content: 'An error occurred while generating the image.' });
          clearInterval(interval);
        }
      }, 10000);
    } catch (error) {
      console.error(error);
      sentMessage.edit({ content: 'An error occurred while generating the image.' });
    }
  }
};
