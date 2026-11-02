// Prints the layout without touching Discord:  npm run preview
const { PermissionFlagsBits: F } = require('discord.js');
const T = require('../template.json');
const { roleName, categoryName, channelName, ACCESS } = require('./layout');
const { buildPanel } = require('./panels');

let bad = 0;
console.log('ROLES (top to bottom)');
for (const r of T.roles) {
  for (const p of r.permissions || []) if (!(p in F)) { console.error(`  !! unknown permission ${p} on ${r.key}`); bad++; }
  console.log('  ' + roleName(r));
}
const who = { public: 'everyone', players: 'Player+', clan: 'Clan Leader+staff', vip: 'VIP+staff', staff: 'Staff', admin: 'Admin/Owner' };
for (const c of T.categories) {
  console.log(`\n${categoryName(c)}   [${who[c.access]}${c.readOnly ? ', read-only' : ''}]`);
  if (c.access !== 'public' && !ACCESS[c.access]) { console.error('  !! bad access'); bad++; }
  for (const ch of c.channels) {
    console.log(`   ${channelName(ch)}${ch.readOnly ? '  (read-only)' : ''}${ch.panel ? '  [panel: ' + ch.panel + ']' : ''}`);
    if (ch.panel) buildPanel(ch.panel);
  }
}
console.log(bad ? `\n${bad} problem(s)` : '\nTemplate OK');
process.exit(bad ? 1 : 0);
