require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Store active giveaways
const activeGiveaways = new Map();

// When the client is ready, run this code
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎉 DT GIVEAWAYS bot is running!`);
});

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Basic ping command
    if (message.content.toLowerCase() === '!ping') {
        message.reply('🏓 Pong! DT GIVEAWAYS is working!');
        return;
    }

    // Help command
    if (message.content.toLowerCase() === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🎉 DT GIVEAWAYS Commands')
            .setColor('#00FF00')
            .setDescription('Here are all available commands:')
            .addFields(
                { name: '!gstart', value: 'Start a new giveaway\nUsage: `!gstart 10m 1 Nitro Classic`\n(time, winners, prize)', inline: false },
                { name: '!gend', value: 'End a giveaway early\nUsage: `!gend <message_id>`', inline: false },
                { name: '!greroll', value: 'Reroll a giveaway winner\nUsage: `!greroll <message_id>`', inline: false },
                { name: '!ping', value: 'Check if bot is working', inline: false },
                { name: '!help', value: 'Show this help message', inline: false }
            )
            .setFooter({ text: 'DT GIVEAWAYS Bot' })
            .setTimestamp();
        
        message.reply({ embeds: [helpEmbed] });
        return;
    }

    // Start giveaway command
    if (message.content.toLowerCase().startsWith('!gstart')) {
        // Check if user has permission
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need "Manage Messages" permission to start giveaways!');
        }

        const args = message.content.slice(7).trim().split(' ');
        
        if (args.length < 3) {
            return message.reply('❌ Usage: `!gstart <time> <winners> <prize>`\nExample: `!gstart 10m 1 Discord Nitro`');
        }

        const time = args[0];
        const winnerCount = parseInt(args[1]);
        const prize = args.slice(2).join(' ');

        // Parse time
        const timeMs = parseTime(time);
        if (!timeMs) {
            return message.reply('❌ Invalid time format! Use: 10s, 5m, 1h, 2d');
        }

        if (isNaN(winnerCount) || winnerCount < 1) {
            return message.reply('❌ Winner count must be a number greater than 0!');
        }

        // Create giveaway embed
        const giveawayEmbed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnerCount}\n**Time:** ${time}\n**Hosted by:** ${message.author}\n\nClick 🎉 to enter!`)
            .setColor('#FF69B4')
            .setFooter({ text: `Ends at` })
            .setTimestamp(Date.now() + timeMs);

        const giveawayMessage = await message.channel.send({ embeds: [giveawayEmbed] });
        await giveawayMessage.react('🎉');

        // Store giveaway data
        activeGiveaways.set(giveawayMessage.id, {
            channelId: message.channel.id,
            guildId: message.guild.id,
            prize: prize,
            winnerCount: winnerCount,
            endTime: Date.now() + timeMs,
            hostId: message.author.id,
            ended: false
        });

        // Set timeout to end giveaway
        setTimeout(() => endGiveaway(giveawayMessage.id), timeMs);

        message.delete().catch(() => {});
        return;
    }

    // End giveaway command
    if (message.content.toLowerCase().startsWith('!gend')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need "Manage Messages" permission to end giveaways!');
        }

        const messageId = message.content.split(' ')[1];
        if (!messageId) {
            return message.reply('❌ Usage: `!gend <message_id>`');
        }

        if (activeGiveaways.has(messageId)) {
            endGiveaway(messageId);
            message.reply('✅ Giveaway ended!');
        } else {
            message.reply('❌ No active giveaway found with that message ID!');
        }
        return;
    }

    // Reroll giveaway command
    if (message.content.toLowerCase().startsWith('!greroll')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need "Manage Messages" permission to reroll giveaways!');
        }

        const messageId = message.content.split(' ')[1];
        if (!messageId) {
            return message.reply('❌ Usage: `!greroll <message_id>`');
        }

        try {
            const channel = message.channel;
            const giveawayMessage = await channel.messages.fetch(messageId);
            
            // Get users who reacted with 🎉
            const reaction = giveawayMessage.reactions.cache.get('🎉');
            if (!reaction) {
                return message.reply('❌ No reactions found on that message!');
            }

            const users = await reaction.users.fetch();
            const participants = users.filter(user => !user.bot);

            if (participants.size === 0) {
                return message.reply('❌ No valid participants found!');
            }

            const winner = participants.random();
            
            const rerollEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Rerolled!')
                .setDescription(`**New Winner:** ${winner}\nCongratulations!`)
                .setColor('#00FF00')
                .setTimestamp();

            message.reply({ embeds: [rerollEmbed] });

        } catch (error) {
            message.reply('❌ Could not find that message or fetch reactions!');
        }
        return;
    }
});

// Function to parse time string to milliseconds
function parseTime(timeString) {
    const time = parseInt(timeString);
    const unit = timeString.slice(-1).toLowerCase();
    
    switch (unit) {
        case 's': return time * 1000;
        case 'm': return time * 60 * 1000;
        case 'h': return time * 60 * 60 * 1000;
        case 'd': return time * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

// Function to end a giveaway
async function endGiveaway(messageId) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway || giveaway.ended) return;

    try {
        const guild = client.guilds.cache.get(giveaway.guildId);
        const channel = guild.channels.cache.get(giveaway.channelId);
        const message = await channel.messages.fetch(messageId);

        // Get reaction users
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) {
            channel.send('❌ No one entered the giveaway!');
            return;
        }

        const users = await reaction.users.fetch();
        const participants = users.filter(user => !user.bot);

        if (participants.size === 0) {
            channel.send('❌ No valid participants found!');
            return;
        }

        // Select winners
        const winners = [];
        const participantArray = Array.from(participants.values());
        
        for (let i = 0; i < Math.min(giveaway.winnerCount, participants.size); i++) {
            const randomIndex = Math.floor(Math.random() * participantArray.length);
            winners.push(participantArray.splice(randomIndex, 1)[0]);
        }

        // Update original message
        const endedEmbed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winners.join(', ')}\n**Hosted by:** <@${giveaway.hostId}>`)
            .setColor('#FF0000')
            .setTimestamp();

        await message.edit({ embeds: [endedEmbed] });

        // Announce winners
        const winnerEmbed = new EmbedBuilder()
            .setTitle('🎊 Congratulations! 🎊')
            .setDescription(`${winners.join(', ')} won **${giveaway.prize}**!\n[Jump to giveaway](${message.url})`)
            .setColor('#00FF00')
            .setTimestamp();

        channel.send({ embeds: [winnerEmbed] });

        // Mark as ended
        giveaway.ended = true;
        activeGiveaways.set(messageId, giveaway);

    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);