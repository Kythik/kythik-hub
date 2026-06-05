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
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: record })
  });
}

client.on('threadCreate', async (thread) => {
  const parentId = thread.parentId;
  let channel = null;
  if (parentId === FARMS_CHANNEL)  channel = 'Farms';
  if (parentId === BUILDS_CHANNEL) channel = 'Builds';
  if (!channel) return;

  try {
    const messages = await thread.messages.fetch({ limit: 1 });
    const first    = messages.last();
    const content  = first ? first.content : '';
    const author   = first ? first.author.username : thread.ownerId;
    const url      = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

    await addToAirtable({
      Title:             thread.name,
      Author:            author,
      Channel:           channel,
      Body:              content,
      DiscordMessageURL: url,
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
