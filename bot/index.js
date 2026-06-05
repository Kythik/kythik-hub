const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const FARMS_CHANNEL  = process.env.FARMS_CHANNEL_ID;
const BUILDS_CHANNEL = process.env.BUILDS_CHANNEL_ID;

/* ── AIRTABLE HELPERS ───────────────────── */
async function addToAirtable(record) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: record })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function deleteFromAirtable(discordThreadURL) {
  // Find the record by DiscordMessageURL
  const searchURL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
    `?filterByFormula=${encodeURIComponent(`{DiscordMessageURL}="${discordThreadURL}"`)}`;

  const res  = await fetch(searchURL, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  if (!data.records || !data.records.length) {
    console.log(`No Airtable record found for ${discordThreadURL}`);
    return;
  }

  const recordId  = data.records[0].id;
  const deleteURL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;

  await fetch(deleteURL, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });

  console.log(`✓ Deleted record: ${recordId}`);
}

/* ── THREAD CREATED ─────────────────────── */
client.on('threadCreate', async (thread) => {
  const parentId = thread.parentId;
  let channel = null;
  if (parentId === FARMS_CHANNEL)  channel = 'Farms';
  if (parentId === BUILDS_CHANNEL) channel = 'Builds';
  if (!channel) return;

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const messages = await thread.messages.fetch({ limit: 100 });
    const first    = messages.last();
    const content  = first ? first.content : '';
    const author   = first ? first.author.username : thread.ownerId;
    const commentCount = Math.max(0, messages.size - 1); // subtract the opening post
    const url      = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

    const images = first
      ? [...first.attachments.values()]
          .filter(a => a.contentType && a.contentType.startsWith('image/'))
          .map(a => a.url)
          .join(', ')
      : '';

    const tags = thread.appliedTags && thread.parent
      ? thread.appliedTags
          .map(tagId => {
            const tag = thread.parent.availableTags.find(t => t.id === tagId);
            return tag ? tag.name : null;
          })
          .filter(Boolean)
          .join(', ')
      : '';

    await addToAirtable({
      Title:             thread.name,
      Author:            author,
      Channel:           channel,
      Body:              content,
      DiscordMessageURL: url,
      Tags:              tags,
      ImageURLs:         images,
      CommentCount:      commentCount,
    });

    console.log(`✓ Saved thread: ${thread.name}`);
  } catch (err) {
    console.error('Error saving thread:', err.message);
  }
});

/* ── THREAD DELETED ─────────────────────── */
client.on('threadDelete', async (thread) => {
  const parentId = thread.parentId;
  if (parentId !== FARMS_CHANNEL && parentId !== BUILDS_CHANNEL) return;

  try {
    const url = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    await deleteFromAirtable(url);
    console.log(`✓ Deleted thread: ${thread.name}`);
  } catch (err) {
    console.error('Error deleting thread:', err.message);
  }
});

/* ── READY ──────────────────────────────── */
client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
