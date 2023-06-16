const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play audio from a YouTube video/playlist or SoundCloud track')
		.addStringOption(option =>
			option
				.setName('keyphrase')
				.setDescription('the first video that would show up in a search for this will be played')
				.setRequired(true)),
};