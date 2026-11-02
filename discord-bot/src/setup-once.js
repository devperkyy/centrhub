// One-shot: log in, build the server, exit.  npm run setup-once
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { runSetup } = require('./setup');

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('Set DISCORD_TOKEN and GUILD_ID in .env (GUILD_ID = your server ID: Discord → Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID)');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await runSetup(guild, client, (l) => console.log(l));
    console.log('\nDone. You can stop the bot now.');
  } catch (e) {
    console.error('Setup failed:', e.message, '\nMake sure the bot role is at the very top of the role list, then run again. It resumes where it stopped.');
    process.exitCode = 1;
  }
  client.destroy();
});
client.login(DISCORD_TOKEN);
