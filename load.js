const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

const { token } = require('./config.json');
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent
	]
});

const player = createAudioPlayer({
	behaviors: {
		noSubscriber: NoSubscriberBehavior.Play
	}
});

player.on('error', error => {
	console.error('Error:', error.message, 'with track', error.resource.metadata.title);
});

play.getFreeClientID().then((clientID) => {
	play.setToken({
		soundcloud : {
			client_id : clientID
		}
	});
});

let queue = [];
let connection;

let playing = 0;
let flag = 0;

let loop = false;
let index = 0;

client.on('ready', () => {
	console.clear();
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;
	await interaction.deferReply({ ephemeral: true });

	connection = joinVoiceChannel({
		channelId: interaction.member.voice.channel.id,
		guildId: interaction.guild.id,
		adapterCreator: interaction.guild.voiceAdapterCreator,
		selfDeaf: false
	});

	connection.subscribe(player);

	function addStream(stream) {
		if (interaction.commandName === 'force') queue.unshift(stream);
		else queue.push(stream);
	}

	switch (interaction.commandName) {
	case 'force':
		player.stop();
		playing = 0;
	case 'play':
		if (!interaction.member.voice?.channel) return;

		try {
			// if nothing is playing
			if (!playing && queue.length == 0) {
				player.play(createAudioResource('./resources/track.wav'));
				playing = 1;
				flag = 1;
			}

			const arg = interaction.options.getString('keyphrase');
			if (arg.includes('soundcloud.com/')) {
				// soundcloud case
				addStream(arg);
			}
			else if (arg.includes('list=')) {
				// youtube playlist
				const playlist = await play.playlist_info(arg, { incomplete : true });
				const videos = await playlist.all_videos();
				await interaction.editReply({ content: 'Added `' + playlist.title + '` by `' + playlist.channel.name + '`', ephemeral: true });
				for (let i = 0; i < videos.length; i++) {
					const video = videos[i];
					addStream(video.url);
				}
			}
			else {
				// youtube video
				const info = await play.search(arg, { limit: 1 });
				await interaction.editReply({ content: 'Added `' + info[0].title + '` by `' + info[0].channel.name + '`', ephemeral: true });
				addStream(info[0].url);
			}
		}
		catch (err) {
			console.error(err);
			return;
		}
		break;

	case 'skip':
		player.stop();
		await interaction.editReply({ content: 'Audio skipped', ephemeral: true });
		break;

	case 'stop':
		player.stop();
		queue = [];
		playing = 0;
		await interaction.editReply({ content: 'Stopped `[ queue cleared ]`', ephemeral: true });
		break;
	case 'leave':
		player.stop();
		connection.destroy();
		queue = [];
		playing = 0;
		await interaction.editReply({ content: 'bye bye `[ queue cleared ]`', ephemeral: true });
		break;

	case 'loop':
		// index - 1 so we don't shift out the current link
		for (let i = 0; i < index - 1; i++) {
			queue.shift();
		}

		loop = !loop;
		index = 0;

		await interaction.editReply({ content: 'Loop mode ; `' + (loop ? 'enabled' : 'disabled') + '`', ephemeral: true });
		break;

	default:
		break;
	}
});

player.on(AudioPlayerStatus.Idle, () => {
	if (flag) {
		flag = 0;
		index = index > queue.length - 1 ? 0 : index;
		async function pass() {
			const stream = await play.stream(queue[index]);
			player.play(createAudioResource(stream.stream, {
				inputType: stream.type
			}));
		}

		pass();
	}
	else if (queue.length > 1 || (loop && queue.length > 0)) {
		flag = 1;
		player.play(createAudioResource('./resources/track.wav'));
		if (loop) index++;
		else queue.shift();
	}
	else {
		if (!loop) {queue.shift();}
		playing = 0;
	}
});

client.on('voiceStateUpdate', (oldState, newState) => {
	const lastConnection = getVoiceConnection(oldState.guild.id);
	if (oldState.channel !== null) {
		if (newState.channel === null) {
			// aww... everyone left
			if (lastConnection && oldState.channel.members.size == 1) {
				const leaveTime = Math.random() * 2000 + 500;
				setTimeout(function() {
					player.stop();
					queue = [];
					lastConnection.destroy();
				}, leaveTime);
			}
		}
		else if (lastConnection && oldState.channel.members.size == 1) {
			// everyone moved, lets go there too
			const leaveTime = Math.random() * 2000 + 500;
			setTimeout(function() {
				joinVoiceChannel({
					channelId: newState.channel.id,
					guildId: newState.guild.id,
					adapterCreator: newState.guild.voiceAdapterCreator,
					selfDeaf: false
				});
			}, leaveTime);
		}
	}
});

process.on('uncaughtException', function(err) {
	console.log(err);
});

client.login(token);