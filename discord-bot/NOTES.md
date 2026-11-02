# Project notes: RustyMadness Discord setup bot

Context for future sessions (no secrets in here).

## Goal
One-time Discord server setup for **RustyMadness**, a Rust game server. User wants it built once, not hosted 24/7.
Claude cannot join Discord from an invite link; the bot needs the user's own token, run on their machine.

## Decisions (all approved by the user)
- Fonts: roles, dividers and category names use Unicode Sans Bold (`src/font.js`); channels stay plain with emoji + `┃`.
- Roles (top to bottom): Staff divider, Owner, Admin, Moderator, Support, Community divider, VIP, Clan Leader, Player,
  Alerts divider, Wipe/Event/Giveaway Alerts, Status divider, Unverified, Muted.
- 11 categories: The Gate, Server Intel, The Wasteland, War Room, Madness Events, Help Desk, Comms, Clan HQ,
  Madlad Lounge (VIP), Staff Area, Admin Office. Defined in `template.json`.
- Permissions: Unverified sees only The Gate; Player unlocks public areas; Muted denied chat/react/speak everywhere
  (except replying inside ticket threads).

## Code
- `npm run preview`: print layout, no Discord.
- `npm run setup-once`: log in, build everything, exit (needs DISCORD_TOKEN + GUILD_ID in `.env`).
- `npm start` + `npm run deploy`: always-on bot with `/setup`, verify / alert / ticket buttons, Unverified auto-role
  (needs Server Members Intent).
- Panel text in `src/panels.js`; placeholders marked `TBA` (server IP, wipe dates, team size). Rules are generic.

## Status
Built and pushed to branch `claude/clever-wright-h7iags`. Not yet run against Discord (no token available to Claude).
Buttons stop working when the bot is offline; Discord Rules Screening is the no-hosting alternative for verification.

## Open items
- Fill in real server IP, wipe schedule, rules.
- Optional: suggestion auto-reactions (needs Message Content intent), live player count (needs RCON/BattleMetrics ID).
- Repo `centrhub` is otherwise a Roblox executor project; the bot lives alone in `discord-bot/`.
