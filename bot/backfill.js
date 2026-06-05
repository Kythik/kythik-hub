/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/backfill.js
   One-time script to import existing Discord
   forum threads into Airtable.
   Run with: node backfill.js
   ═══════════════════════════════════════════ */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const FARMS_CHANNEL  = process.env.FARMS_CHANNEL_ID;
const BUILDS_CHANNEL = process.env.BUILDS_CHANNEL_ID;

/* ── DISCORD HELPERS ────────────────────── */
async function getArchivedThreads(channelId) {
  const threads = [];
  let before = null;

  while (true) {
    const url = `https://discord.com/api/v10/channels/${channelId}/threads/archived/public?limit=100` +
      (before ? `&before=${before}` : '');

    const res  = await fetch(url, {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` }
    });

    if (!res.ok) {
      console.error(`Failed to fetch archived threads: ${res.status}`);
      break;
    }

    const data = await res.json();
    threads.push(...(data.threads || []));

    if (!data.has_more) break;
    const last = data.threads[data.threads.length - 1];
    before = last.thread_metadata.archive_timestamp;
  }

  return threads;
}

async function getActiveThreads(channelId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/threads/active`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.threads || []).filter(t => t.parent_id === channelId);
}

async function getThreadFirstMessage(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return { content: '', author: '', images: '', commentCount: 0 };

  const messages = await res.json();
  if (!messages.length) return { content: '', author: '', images: '', commentCount: 0 };

  // Messages come newest first — get the oldest (first post)
  const first  = messages[messages.length - 1];
  const images = (first.attachments || [])
    .filter(a => a.content_type && a.content_type.startsWith('image/'))
    .map(a => a.url)
    .join(', ');

  return {
    content:      first.content || '',
    author:       first.author?.username || '',
    images,
    commentCount: Math.max(0, messages.length - 1),
  };
}

/* ── AIRTABLE HELPERS ───────────────────── */
async function getExistingURLs() {
  const existing = new Set();
  let offset = null;

  while (true) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
      `?fields[]=DiscordMessageURL${offset ? `&offset=${offset}` : ''}`;

    const res  = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    const data = await res.json();

    (data.records || []).forEach(r => {
      if (r.fields.DiscordMessageURL) existing.add(r.fields.DiscordMessageURL);
    });

    if (!data.offset) break;
    offset = data.offset;
  }

  return existing;
}

async function addToAirtable(record) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: record })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

/* ── PROCESS CHANNEL ────────────────────── */
async function processChannel(channelId, channelName) {
  console.log(`\nFetching threads from ${channelName}...`);

  const [active, archived] = await Promise.all([
    getActiveThreads(channelId),
    getArchivedThreads(channelId),
  ]);

  const allThreads = [...active, ...archived];
  console.log(`Found ${allThreads.length} threads (${active.length} active, ${archived.length} archived)`);
  return allThreads.map(t => ({ ...t, channelName }));
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('═══════════════════════════════════');
  console.log('  Kythik Hub — Backfill Script');
  console.log('═══════════════════════════════════');

  // Get existing records to avoid duplicates
  console.log('\nChecking existing Airtable records...');
  const existingURLs = await getExistingURLs();
  console.log(`Found ${existingURLs.size} existing records — skipping these.`);

  // Fetch all threads from both channels
  const farmsThreads  = await processChannel(FARMS_CHANNEL, 'Farms');
  const buildsThreads = await processChannel(BUILDS_CHANNEL, 'Builds');
  const allThreads    = [...farmsThreads, ...buildsThreads];

  console.log(`\nTotal threads to process: ${allThreads.length}`);

  let imported = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const thread of allThreads) {
    const guildId    = thread.guild_id;
    const discordURL = `https://discord.com/channels/${guildId}/${thread.id}`;

    // Skip if already in Airtable
    if (existingURLs.has(discordURL)) {
      skipped++;
      continue;
    }

    try {
      const { content, author, images, commentCount } = await getThreadFirstMessage(thread.id);

      // Extract tags from applied_tags
      const tags = (thread.applied_tags || [])
        .map(tagId => {
          // Tags are stored as IDs — we'll store the IDs as a comma list
          // The bot has access to parent channel tag names; backfill stores IDs
          return tagId;
        })
        .join(', ');

      await addToAirtable({
        Title:             thread.name,
        Author:            author,
        Channel:           thread.channelName,
        Body:              content,
        DiscordMessageURL: discordURL,
        ImageURLs:         images,
        CommentCount:      commentCount,
      });

      console.log(`✓ Imported: ${thread.name}`);
      imported++;

      // Rate limit protection — Airtable allows ~5 req/sec
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (err) {
      console.error(`✗ Failed: ${thread.name} — ${err.message}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  Done!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped} (already existed)`);
  console.log(`  Failed:   ${failed}`);
  console.log('═══════════════════════════════════');
}

run().catch(console.error);
