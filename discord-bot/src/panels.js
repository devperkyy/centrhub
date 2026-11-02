const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const T = require('../template.json');
const { sansBold } = require('./font');

const COLOR = parseInt(T.color.replace('#', ''), 16);
const embed = (title, desc) => new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(desc).setFooter({ text: T.brand });
const btn = (id, label, style = ButtonStyle.Secondary, emoji) => {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
};
const row = (...b) => new ActionRowBuilder().addComponents(...b);

// EDIT THE TEXT BELOW to match your real server details.
const panels = {
  welcome: () => ({
    embeds: [embed(`🔥 ${sansBold('Welcome to ' + T.brand)}`,
      `Rust, but unhinged.\n\n**1.** Read <#RULES>\n**2.** Press the button in <#VERIFY>\n**3.** Grab the server IP from the connect-info channel and drop in.\n\nSee you on the island.`)],
  }),
  rules: () => ({
    embeds: [embed(`📜 ${sansBold('Server Rules')}`, [
      '**1. Respect everyone.** No harassment, hate speech, racism or targeted toxicity.',
      '**2. No cheating.** Cheats, macros, scripts and exploits mean a permanent ban.',
      '**3. No ghosting or stream sniping.**',
      '**4. No advertising** other servers or communities.',
      '**5. Keep it clean.** No NSFW or illegal content.',
      '**6. Listen to staff.** Argue it in a ticket, not in chat.',
      '**7. One account per player.** Ban evasion means a permanent ban.',
      '',
      '*Staff can act on anything that harms the community, even if it is not listed.*',
    ].join('\n'))],
  }),
  verify: () => ({
    embeds: [embed(`✅ ${sansBold('Spawn In')}`, 'Read the rules, then press the button to unlock the rest of the server.')],
    components: [row(btn('verify', 'I accept the rules', ButtonStyle.Success, '✅'))],
  }),
  info: () => ({
    embeds: [embed(`🌐 ${sansBold('Connect')}`, [
      '**Server IP:** `TBA`',
      '**How to join:** open Rust, press F1, type `client.connect <ip>`',
      '**Max team size:** TBA',
      '**Map / mods:** TBA',
    ].join('\n'))],
  }),
  wipe: () => ({
    embeds: [embed(`🗓️ ${sansBold('Wipe Schedule')}`, '**Map wipe:** TBA\n**Blueprint wipe:** TBA\n\nGet pinged with the Wipe Alerts role in the get-alerts channel.')],
  }),
  alerts: () => ({
    embeds: [embed(`🔔 ${sansBold('Pick Your Alerts')}`, 'Press a button to toggle the role on or off.')],
    components: [row(
      btn('alert:wipealerts', 'Wipe Alerts', ButtonStyle.Secondary, '☢️'),
      btn('alert:eventalerts', 'Event Alerts', ButtonStyle.Secondary, '🎯'),
      btn('alert:giveawayalerts', 'Giveaway Alerts', ButtonStyle.Secondary, '🎁'),
    )],
  }),
  ticket_general: () => ({
    embeds: [embed(`🎫 ${sansBold('Need Help?')}`, 'Press the button to open a private ticket with staff.')],
    components: [row(btn('ticket:general', 'Open ticket', ButtonStyle.Primary, '🎫'))],
  }),
  ticket_report: () => ({
    embeds: [embed(`🚨 ${sansBold('Report a Player')}`, 'Press the button. Include their name, the time, and clips or screenshots.')],
    components: [row(btn('ticket:report', 'Report a player', ButtonStyle.Danger, '🚨'))],
  }),
  ticket_appeal: () => ({
    embeds: [embed(`⚖️ ${sansBold('Ban Appeals')}`, 'Press the button to appeal a ban or punishment. Be honest and include your in-game name.')],
    components: [row(btn('ticket:appeal', 'Appeal a ban', ButtonStyle.Primary, '⚖️'))],
  }),
};

// Placeholders <#RULES> / <#VERIFY> are replaced with real channel mentions during setup.
function buildPanel(name, links = {}) {
  const p = panels[name]();
  const swap = (s) => (typeof s === 'string' ? s.replace('<#RULES>', links.rules || '#the-rules').replace('<#VERIFY>', links.verify || '#spawn-in') : s);
  p.embeds.forEach((e) => e.setDescription(swap(e.data.description)));
  return p;
}

const closeRow = (userId) => row(btn(`close:${userId}`, 'Close ticket', ButtonStyle.Secondary, '🔒'));

module.exports = { buildPanel, closeRow, embed };
