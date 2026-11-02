const { ChannelType, PermissionFlagsBits: F, PermissionsBitField } = require('discord.js');
const T = require('../template.json');
const { roleName, categoryName, channelName, WRITERS, ACCESS } = require('./layout');
const { buildPanel } = require('./panels');

const findRole = (guild, key) => {
  const def = T.roles.find((r) => r.key === key);
  return def ? guild.roles.cache.find((r) => r.name === roleName(def)) : undefined;
};

const MUTE_DENY = [F.SendMessages, F.SendMessagesInThreads, F.AddReactions, F.CreatePublicThreads, F.CreatePrivateThreads, F.Speak, F.Stream];

function buildOverwrites(guild, roles, { access, readOnly, ticket, afk }) {
  const map = new Map();
  const add = (id, allow = [], deny = []) => {
    const e = map.get(id) || { allow: new Set(), deny: new Set() };
    allow.forEach((p) => { e.allow.add(p); e.deny.delete(p); });
    deny.forEach((p) => { if (!e.allow.has(p)) e.deny.add(p); });
    map.set(id, e);
  };
  const everyone = guild.roles.everyone.id;
  const view = [F.ViewChannel, F.ReadMessageHistory];
  const lock = [F.SendMessages, F.CreatePublicThreads, F.CreatePrivateThreads];
  if (!ticket) lock.push(F.SendMessagesInThreads);

  if (access === 'public') {
    add(everyone, view, [...lock, F.AddReactions]);
  } else {
    add(everyone, [], [F.ViewChannel, ...(readOnly ? lock : [])]);
    for (const k of ACCESS[access]) add(roles.get(k).id, view);
  }
  if (access === 'public' || readOnly) {
    for (const k of WRITERS) add(roles.get(k).id, [F.SendMessages, F.SendMessagesInThreads, F.CreatePublicThreads]);
  }
  if (afk) add(everyone, [], [F.Speak, F.Stream]);

  const muted = roles.get('muted');
  add(muted.id, [], ticket ? MUTE_DENY.filter((p) => p !== F.SendMessagesInThreads) : MUTE_DENY);

  return [...map].map(([id, e]) => ({ id, allow: [...e.allow], deny: [...e.deny] }));
}

async function runSetup(guild, client, log = () => {}) {
  await guild.roles.fetch();
  const roles = new Map();

  // Create bottom-to-top: each new role lands just above @everyone, so the first item ends up on top.
  for (const def of [...T.roles].reverse()) {
    let role = findRole(guild, def.key);
    if (role) {
      log(`Skipped role ${def.name}`);
    } else {
      role = await guild.roles.create({
        name: roleName(def),
        color: def.color || undefined,
        hoist: def.hoist ?? false,
        mentionable: def.mentionable ?? false,
        permissions: new PermissionsBitField((def.permissions || []).map((p) => F[p])),
        reason: 'RustyMadness setup',
      });
      log(`Created role ${def.name}`);
    }
    roles.set(def.key, role);
  }

  await guild.channels.fetch();
  const links = {};
  const panelJobs = [];

  for (const cat of T.categories) {
    const cName = categoryName(cat);
    let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cName);
    const catOverwrites = buildOverwrites(guild, roles, { access: cat.access, readOnly: false });
    if (!category) {
      category = await guild.channels.create({ name: cName, type: ChannelType.GuildCategory, permissionOverwrites: catOverwrites, reason: 'RustyMadness setup' });
      log(`Created category ${cat.name}`);
    } else {
      log(`Skipped category ${cat.name}`);
    }

    for (const ch of cat.channels) {
      const isVoice = ch.type === 'voice';
      const type = isVoice ? ChannelType.GuildVoice : ChannelType.GuildText;
      const name = channelName(ch);
      let channel = guild.channels.cache.find((c) => c.parentId === category.id && c.type === type && c.name === name);
      if (!channel) {
        channel = await guild.channels.create({
          name, type, parent: category.id,
          topic: isVoice ? undefined : ch.topic,
          userLimit: isVoice ? ch.limit : undefined,
          permissionOverwrites: buildOverwrites(guild, roles, {
            access: cat.access,
            readOnly: !isVoice && (cat.readOnly || ch.readOnly || ch.ticket),
            ticket: ch.ticket,
            afk: ch.afk,
          }),
          reason: 'RustyMadness setup',
        });
        log(`Created ${isVoice ? 'voice' : 'channel'} ${ch.name}`);
      }
      if (ch.name === 'the-rules') links.rules = `<#${channel.id}>`;
      if (ch.name === 'spawn-in') links.verify = `<#${channel.id}>`;
      if (ch.panel) panelJobs.push({ channel, panel: ch.panel });
    }
  }

  for (const { channel, panel } of panelJobs) {
    const recent = await channel.messages.fetch({ limit: 10 });
    if (recent.some((m) => m.author.id === client.user.id)) continue;
    await channel.send(buildPanel(panel, links));
    log(`Posted ${panel} panel`);
  }
}

module.exports = { runSetup, findRole, buildOverwrites };
