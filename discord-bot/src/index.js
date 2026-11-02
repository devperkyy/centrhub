require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { runSetup, findRole } = require('./setup');
const { handleButton } = require('./buttons');

if (!process.env.DISCORD_TOKEN) {
  console.error('Set DISCORD_TOKEN in .env');
  process.exit(1);
}

// GuildMembers is a privileged intent: enable "Server Members Intent" in the developer portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('guildMemberAdd', async (member) => {
  const role = findRole(member.guild, 'unverified');
  if (role) await member.roles.add(role).catch((e) => console.error('Could not assign Unverified:', e.message));
});

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) return await handleButton(i);
    if (!i.isChatInputCommand() || i.commandName !== 'setup') return;

    if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ content: 'Only administrators can run this.', ephemeral: true });
    }
    await i.deferReply({ ephemeral: true });
    const lines = [];
    try {
      await runSetup(i.guild, client, (l) => lines.push(l));
      const created = lines.filter((l) => l.startsWith('Created') || l.startsWith('Posted')).length;
      await i.editReply(`Setup complete. ${created} item(s) created, ${lines.length - created} already existed.`);
    } catch (err) {
      console.error(err);
      await i.editReply(`Setup failed: ${err.message}\nMake sure the bot's role is at the very top of the role list, then run /setup again. It picks up where it stopped.`);
    }
  } catch (err) {
    console.error(err);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
