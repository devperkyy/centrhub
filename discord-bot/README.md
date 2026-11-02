# Server Setup Bot

`/setup` (admins only) creates the roles, categories and channels defined in `template.json`.
It skips anything that already exists, so it is safe to re-run.

## Discord setup
1. https://discord.com/developers/applications → New Application → Bot → copy the token.
2. OAuth2 → URL Generator: scopes `bot` + `applications.commands`, permissions `Manage Roles` + `Manage Channels`. Invite it.
3. In the server, drag the bot's role above the roles it will create.

## Run
```
cp .env.example .env   # fill in DISCORD_TOKEN and CLIENT_ID
npm install
npm run deploy         # registers /setup
npm start
```

## Host 24/7
Deploy the `discord-bot` folder with its Dockerfile to Fly.io, Railway or Render, and set
`DISCORD_TOKEN` and `CLIENT_ID` as environment secrets.

Edit `template.json` to change the layout.
