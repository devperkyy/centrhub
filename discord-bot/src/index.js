require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { runSetup } = require('./setup');

if (!process.env.DISCORD_TOKEN) {
  console.error('Set DISCORD_TOKEN in .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup') return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Only administrators can run this.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const lines = [];
  try {
    await runSetup(interaction.guild, (l) => lines.push(l));
    await interaction.editReply(`Setup complete:\n${lines.join('\n')}`.slice(0, 1900));
  } catch (err) {
    console.error(err);
    await interaction.editReply(`Setup failed: ${err.message}\n(Make sure the bot has Manage Roles + Manage Channels and its role is above the roles it creates.)`);
  }
});

client.login(process.env.DISCORD_TOKEN);
