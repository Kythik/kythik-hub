/* ═══════════════════════════════════════════
   api/airtable.js — Vercel serverless function
   Blob-cached (public store). 6hr TTL.
   ═══════════════════════════════════════════ */

import { put, list, del } from '@vercel/blob';

const CACHE_KEY    = 'strategies-cache.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function clearOldBlobs(token) {
  try {
    const { blobs } = await list({ prefix: CACHE_KEY, token });
    if (blobs.length === 0) return;
    for (const blob of blobs) {
      await del(blob.url, { token });
    }
    console.log(`Deleted ${blobs.length} old blob(s)`);
  } catch(e) {
    console.warn('Blob delete failed:', e.message);
  }
}

async function fetchFromAirtable(AIRTABLE_TOKEN, BASE) {
  const TABLE = 'Strategies';

  let SEASON_START = '2026-04-16T19:00:00-07:00';
  let SEASON_NAME  = 'SS12: Lunaria';
  try {
    const cfg = await fetch('https://raw.githubusercontent.com/kythikx/kythik-hub/main/season.json').then(r => r.json());
    if (cfg.seasonStart) SEASON_START = cfg.seasonStart;
    if (cfg.seasonName)  SEASON_NAME  = cfg.seasonName;
  } catch(e) { /* use defaults */ }

  const seasonISO = new Date(SEASON_START).toISOString();
  const formula   = encodeURIComponent(
    `OR(IS_AFTER({PostedAt}, '${seasonISO}'), AND({PostedAt}='', IS_AFTER({Created}, '${seasonISO}')))`
  );

  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&sort[0][field]=Created&sort[0][direction]=desc&maxRecords=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);

  const data    = await res.json();
  const records = (data.records || []).map(r => ({ id: r.id, ...r.fields }));

  return {
    records,
    season:      SEASON_NAME,
    seasonStart: SEASON_START,
    lastUpdated: new Date().toISOString(),
    count:       records.length,
    fromCache:   false,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const BLOB_TOKEN     = process.env.BLOB_READ_WRITE_TOKEN;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE           = process.env.AIRTABLE_BASE;

  if (!AIRTABLE_TOKEN || !BASE) {
    return res.status(500).json({ error: 'Missing Airtable credentials.' });
  }

  try {
    // ── Try Blob cache ────────────────────────
    const { blobs } = await list({ prefix: CACHE_KEY, token: BLOB_TOKEN });
    console.log(`Found ${blobs.length} blob(s)`);

    if (blobs.length > 0) {
      // Use newest, delete extras
      const sorted = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const fresh  = sorted[0];
      const stale  = sorted.slice(1);

      // Delete any extras silently
      for (const b of stale) {
        del(b.url, { token: BLOB_TOKEN }).catch(() => {});
      }

      const age = Date.now() - new Date(fresh.uploadedAt).getTime();
      console.log(`Cache age: ${Math.round(age/60000)}min, fresh: ${age < CACHE_TTL_MS}`);

      if (age < CACHE_TTL_MS) {
        const cacheRes = await fetch(fresh.url);
        if (cacheRes.ok) {
          const cached     = await cacheRes.json();
          cached.fromCache = true;
          console.log('Serving from cache');
          return res.status(200).json(cached);
        }
      }
    }

    // ── Cache miss — fetch Airtable ───────────
    console.log('Cache miss — fetching Airtable');
    const payload = await fetchFromAirtable(AIRTABLE_TOKEN, BASE);

    // Clear old blobs then write new one
    await clearOldBlobs(BLOB_TOKEN);
    await put(CACHE_KEY, JSON.stringify(payload), {
      access:      'public',
      token:       BLOB_TOKEN,
      contentType: 'application/json',
    });
    console.log('Cache written');

    return res.status(200).json(payload);

  } catch (err) {
    console.error('airtable.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
