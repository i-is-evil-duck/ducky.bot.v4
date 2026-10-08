const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
  name: 'generate',
  description: 'generates an image based on the given prompt. Alternative (!gen)',
  cooldown: 3000,
  async run(client, message, args) {
    const prompt = args.join(' ');
  const fetch = await import('node-fetch');

    const url = 'https://api.tryleap.ai/api/v1/images/models/ee88d150-4259-4b77-9d0f-090abe29f650/inferences';
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer 0db21d89-da13-41c3-b353-a1711b981a64'
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

      const checkImageUrl = `https://api.tryleap.ai/api/v1/images/models/ee88d150-4259-4b77-9d0f-090abe29f650/inferences/${id}`;
      const checkImageOptions = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: 'Bearer 0db21d89-da13-41c3-b353-a1711b981a64'
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
