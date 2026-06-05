/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/cron.js
   Runs every 30 minutes via Railway cron.
   - Refreshes comment counts from Discord
   - Auto-deletes Airtable records for deleted threads
   ═══════════════════════════════════════════ */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;

/* ── AIRTABLE ───────────────────────────── */
async function getRecords() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
    `?fields[]=DiscordMessageURL&fields[]=CommentCount`;
  const res  = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();
  return data.records || [];
}

async function updateCommentCount(recordId, count) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: { CommentCount: count } })
  });
}

async function deleteAirtableRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
}

/* ── DISCORD ────────────────────────────── */
async function getThreadMessageCount(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (res.status === 404) return 'deleted';
  if (!res.ok) return null;
  const messages = await res.json();
  return Math.max(0, messages.length - 1);
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('Starting comment count refresh...');
  const records = await getRecords();
  console.log(`Found ${records.length} records to check.`);

  for (const record of records) {
    const discordURL = record.fields.DiscordMessageURL;
    if (!discordURL) continue;

    const parts    = discordURL.split('/');
    const threadId = parts[parts.length - 1];

    const count = await getThreadMessageCount(threadId);

    if (count === 'deleted') {
      await deleteAirtableRecord(record.id);
      console.log(`✓ Deleted orphaned record: ${discordURL}`);
    } else if (count === null) {
      console.log(`Skipped ${threadId} — couldn't fetch messages`);
    } else {
      await updateCommentCount(record.id, count);
      console.log(`✓ Updated ${discordURL} → ${count} comments`);
    }

    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('Done.');
}

run().catch(console.error);
