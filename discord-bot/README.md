# RustyMadness Setup Bot

`/setup` (admins only) builds the whole server: roles, dividers, categories, channels, permissions,
and posts the welcome / rules / verify / ticket / alert panels. Safe to re-run; it skips what exists.

- `npm run preview` prints the full layout without touching Discord.
- Edit `template.json` (layout) and `src/panels.js` (panel text, search for `TBA`).

## Setup
1. https://discord.com/developers/applications → New Application → Bot → copy the token.
2. Bot tab → enable **Server Members Intent** (needed to auto-assign Unverified).
3. OAuth2 → URL Generator → scopes `bot` + `applications.commands`, permission **Administrator** → open the URL and add it to your server.
4. In Server Settings → Roles, drag the bot's role to the very top.
5. Run:
```
cp .env.example .env   # fill DISCORD_TOKEN and CLIENT_ID (and GUILD_ID for instant commands)
npm install
npm run deploy
npm start
```
6. In Discord, run `/setup`.

## Host 24/7
Deploy this folder with its Dockerfile to Fly.io, Railway or Render; set `DISCORD_TOKEN` and `CLIENT_ID` as secrets.
The bot must stay running: the verify, alert and ticket buttons and Unverified auto-role all need it online.

## One-time setup only (no hosting)
Fill `DISCORD_TOKEN` and `GUILD_ID` in `.env`, then `npm run setup-once`. It builds everything and exits.
Afterwards the verify / alert / ticket buttons won't respond unless the bot is running again
(use Discord's built-in Rules Screening for verification if you don't want to host it).
