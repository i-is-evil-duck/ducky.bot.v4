const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'vid',
    description: 'Gets a video from a list',
    usage: '`!vid <video name>` or `!vid -list`',



run: async (client, message, args) => {
    const invis = '||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _';

    if (args.length === 0) {
        const usageEmbed = new EmbedBuilder()
            .setTitle('Usage')
            .setDescription(module.exports.usage)
            .setColor('#eee657');

        message.channel.send({ embeds: [usageEmbed] });
        return;
    }

    if (args[0] === '-list') {
        const list = fs.readFileSync('./programs/list.txt', 'utf-8').trim();
        const videoList = list.split('\n').map((line, index) => `${index + 1}. ${line.split(';')[0]}`);

        const embed = new EmbedBuilder()
            .setTitle('List of Videos')
            .setDescription(videoList.join('\n'))
            .setColor('#eee657');

        message.channel.send({ embeds: [embed] });
        return;
    }

    const input = args.join(' ').toLowerCase();
    const listLines = fs.readFileSync('./programs/list.txt', 'utf-8').split('\n');
    const numberedVideoList = listLines.map((line, index) => ({ number: index + 1, name: line.split(';')[0], url: line.split(';')[1] }));

    const selectedVideo = numberedVideoList.find(video => input === video.name.toLowerCase() || input === '-' + video.number.toString());

    if (selectedVideo) {
        const nameEmbed = new EmbedBuilder()
            .setTitle(selectedVideo.name)
            .setColor('#eee657');

        message.channel.send({ embeds: [nameEmbed] });
        message.channel.send(`${invis} ${selectedVideo.url}`);
    } else {
        const embed = new EmbedBuilder()
            .setTitle('Video Not Found')
            .setDescription(`Sorry, I couldn't find a video with the name "${args.join(' ')}".`)
            .setColor('#eee657');

        message.channel.send({ embeds: [embed] });

        const usageEmbed = new EmbedBuilder()
            .setTitle('Usage')
            .setDescription(module.exports.usage)
            .setColor('#eee657');

        message.channel.send({ embeds: [usageEmbed] });
    }
}

};
