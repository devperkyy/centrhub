const { ChannelType, ThreadAutoArchiveDuration, PermissionFlagsBits: F } = require('discord.js');
const T = require('../template.json');
const { findRole } = require('./setup');
const { closeRow, embed } = require('./panels');

const TICKET = {
  general: 'Support ticket',
  report: 'Player report',
  appeal: 'Ban appeal',
};

async function handleButton(i) {
  const [kind, arg] = i.customId.split(':');
  const reply = (content) => i.reply({ content, ephemeral: true });

  if (kind === 'verify') {
    const player = findRole(i.guild, 'player');
    const unverified = findRole(i.guild, 'unverified');
    if (!player) return reply('Setup has not been run yet.');
    if (i.member.roles.cache.has(player.id)) return reply('You are already verified.');
    await i.member.roles.add(player);
    if (unverified && i.member.roles.cache.has(unverified.id)) await i.member.roles.remove(unverified);
    return reply(`✅ You're in. Welcome to ${T.brand}!`);
  }

  if (kind === 'alert') {
    const role = findRole(i.guild, arg);
    if (!role) return reply('That role does not exist.');
    if (i.member.roles.cache.has(role.id)) {
      await i.member.roles.remove(role);
      return reply(`Removed **${T.roles.find((r) => r.key === arg).name}**.`);
    }
    await i.member.roles.add(role);
    return reply(`Added **${T.roles.find((r) => r.key === arg).name}**.`);
  }

  if (kind === 'ticket') {
    if (!TICKET[arg]) return;
    const name = `${arg}-${i.user.username}`.slice(0, 90);
    const active = await i.channel.threads.fetchActive();
    const existing = active.threads.find((t) => t.name === name);
    if (existing) return reply(`You already have one open: ${existing}`);
    const thread = await i.channel.threads.create({
      name, type: ChannelType.PrivateThread, invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: `${TICKET[arg]} by ${i.user.tag}`,
    });
    await thread.members.add(i.user.id);
    const pings = ['support', 'moderator'].map((k) => findRole(i.guild, k)).filter(Boolean).map((r) => `<@&${r.id}>`).join(' ');
    await thread.send({
      content: `${i.user} ${pings}`,
      embeds: [embed(`🎫 ${TICKET[arg]}`, 'Describe what happened. Staff will be with you shortly.')],
      components: [closeRow(i.user.id)],
    });
    return reply(`Ticket opened: ${thread}`);
  }

  if (kind === 'close') {
    if (i.user.id !== arg && !i.memberPermissions.has(F.ManageThreads)) return reply('Only the ticket owner or staff can close this.');
    await i.reply('🔒 Closing ticket.');
    await i.channel.setLocked(true);
    await i.channel.setArchived(true);
  }
}

module.exports = { handleButton };
