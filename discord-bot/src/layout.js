// Pure helpers shared by setup + preview (no Discord calls).
const { sansBold } = require('./font');

const roleName = (r) => (r.divider ? `━━━ ${sansBold(r.name.toUpperCase())} ━━━` : sansBold(r.name));
const categoryName = (c) => `${c.emoji} ━ ${sansBold(c.name)}`;
const channelName = (ch) =>
  ch.type === 'voice' ? ch.name : `${ch.emoji}┃${ch.name}`.toLowerCase().replace(/ /g, '-');

const STAFF = ['support', 'moderator', 'admin', 'owner'];
const WRITERS = ['moderator', 'admin', 'owner'];
const ACCESS = {
  players: ['player', 'vip', 'clanleader', ...STAFF],
  clan: ['clanleader', 'moderator', 'admin', 'owner'],
  vip: ['vip', ...STAFF],
  staff: STAFF,
  admin: ['admin', 'owner'],
};

module.exports = { roleName, categoryName, channelName, STAFF, WRITERS, ACCESS };
