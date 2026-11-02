const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const template = require('../template.json');

const STAFF_ROLES = ['Admin', 'Moderator'];

async function findOrCreateRole(guild, def) {
  const existing = guild.roles.cache.find((r) => r.name === def.name);
  if (existing) return { role: existing, created: false };
  const role = await guild.roles.create({
    name: def.name,
    color: def.color,
    hoist: def.hoist ?? false,
    permissions: new PermissionsBitField((def.permissions || []).map((p) => PermissionFlagsBits[p])),
    reason: 'Server setup',
  });
  return { role, created: true };
}

async function runSetup(guild, log = () => {}) {
  const everyone = guild.roles.everyone;
  const roles = new Map();

  for (const def of template.roles) {
    const { role, created } = await findOrCreateRole(guild, def);
    roles.set(def.name, role);
    log(`${created ? 'Created' : 'Skipped existing'} role ${def.name}`);
  }

  await guild.channels.fetch();

  for (const cat of template.categories) {
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === cat.name.toLowerCase(),
    );
    if (!category) {
      const overwrites = [];
      if (cat.staffOnly) {
        overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
        for (const n of STAFF_ROLES) {
          if (roles.has(n)) overwrites.push({ id: roles.get(n).id, allow: [PermissionFlagsBits.ViewChannel] });
        }
      }
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        reason: 'Server setup',
      });
      log(`Created category ${cat.name}`);
    } else {
      log(`Skipped existing category ${cat.name}`);
    }

    for (const ch of cat.channels) {
      const type = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
      const exists = guild.channels.cache.find(
        (c) => c.parentId === category.id && c.type === type && c.name.toLowerCase().replace(/ /g, '-') === ch.name.toLowerCase().replace(/ /g, '-'),
      );
      if (exists) {
        log(`Skipped existing channel ${ch.name}`);
        continue;
      }
      const overwrites = [];
      if (ch.readOnly) {
        overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.SendMessages] });
      }
      await guild.channels.create({
        name: ch.name,
        type,
        parent: category.id,
        permissionOverwrites: overwrites,
        reason: 'Server setup',
      });
      log(`Created channel ${ch.name}`);
    }
  }
}

module.exports = { runSetup };
