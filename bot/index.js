const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

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

async function addToAirtable(record) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: record })
  });
  const data = await res.json();
  console.log('Airtable response:', JSON.stringify(data));
}

client.on('threadCreate', async (thread) => {
  const parentId = thread.parentId;
  let channel = null;
  if (parentId === FARMS_CHANNEL)  channel = 'Farms';
  if (parentId === BUILDS_CHANNEL) channel = 'Builds';
  if (!channel) return;

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const messages = await thread.messages.fetch({ limit: 1 });
    const first    = messages.last();
    const content  = first ? first.content : '';
    const author   = first ? first.author.username : thread.ownerId;
    const url      = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

    // Grab image attachments
    const images = first
      ? [...first.attachments.values()]
          .filter(a => a.contentType && a.contentType.startsWith('image/'))
          .map(a => a.url)
          .join(', ')
      : '';

    // Grab forum thread tags
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
    });

    console.log(`✓ Saved thread: ${thread.name}`);
  } catch (err) {
    console.error('Error saving thread:', err.message);
  }
});

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
