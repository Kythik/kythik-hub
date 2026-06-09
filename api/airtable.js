/* ═══════════════════════════════════════════
   api/airtable.js — Vercel serverless function
   Blob-cached (public store). 6hr TTL.
   ═══════════════════════════════════════════ */

import { put, list, del } from '@vercel/blob';

const CACHE_KEY    = 'strategies-cache.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // ── Try Blob cache first ──────────────────
    try {
      const { blobs } = await list({ prefix: CACHE_KEY, token: BLOB_TOKEN });
      console.log('Blobs found:', blobs.length);
      if (blobs.length > 0) {
        const blob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
        const age  = Date.now() - new Date(blob.uploadedAt).getTime();
        console.log('Blob age (ms):', age, 'TTL:', CACHE_TTL_MS, 'Fresh:', age < CACHE_TTL_MS);
        if (age < CACHE_TTL_MS) {
          const cacheRes = await fetch(blob.url);
          console.log('Cache fetch status:', cacheRes.status);
          if (cacheRes.ok) {
            const cached     = await cacheRes.json();
            cached.fromCache = true;
            return res.status(200).json(cached);
          }
        }
      }
    } catch(e) {
      console.warn('Cache read failed:', e.message);
    }

    // ── Cache miss — fetch from Airtable ──────
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE  = process.env.AIRTABLE_BASE;
    const TABLE = 'Strategies';

    if (!AIRTABLE_TOKEN || !BASE) throw new Error('Missing Airtable credentials.');

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

    const airtableRes = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!airtableRes.ok) throw new Error(`Airtable ${airtableRes.status}`);

    const data    = await airtableRes.json();
    const records = (data.records || []).map(r => ({ id: r.id, ...r.fields }));

    const payload = {
      records,
      season:      SEASON_NAME,
      seasonStart: SEASON_START,
      lastUpdated: new Date().toISOString(),
      count:       records.length,
      fromCache:   false,
    };

    // ── Delete old blobs, write fresh cache ───
    try {
      const { blobs } = await list({ prefix: CACHE_KEY, token: BLOB_TOKEN });
      if (blobs.length > 0) {
        await del(blobs.map(b => b.url), { token: BLOB_TOKEN });
      }
      await put(CACHE_KEY, JSON.stringify(payload), {
        access:      'public',
        token:       BLOB_TOKEN,
        contentType: 'application/json',
      });
      console.log('Blob cache refreshed');
    } catch(e) {
      console.error('Blob write failed:', e.message);
    }

    return res.status(200).json(payload);

  } catch (err) {
    console.error('airtable.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
