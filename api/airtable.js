/* ═══════════════════════════════════════════
   api/airtable.js — Vercel serverless function
   6hr cache. Season filtered. 
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE  = process.env.AIRTABLE_BASE;
  const TABLE = 'Strategies';

  if (!TOKEN || !BASE) {
    return res.status(500).json({ error: 'Missing Airtable credentials.' });
  }

  try {
    // Fetch season config from repo
    let SEASON_START = '2026-04-16T19:00:00-07:00';
    let SEASON_NAME  = 'SS12: Lunaria';
    try {
      const cfg = await fetch('https://raw.githubusercontent.com/kythikx/kythik-hub/main/season.json').then(r => r.json());
      if (cfg.seasonStart) SEASON_START = cfg.seasonStart;
      if (cfg.seasonName)  SEASON_NAME  = cfg.seasonName;
    } catch(e) { /* use defaults */ }

    const seasonISO = new Date(SEASON_START).toISOString();

    // Fall back to Created if PostedAt is empty
    const formula = encodeURIComponent(
      `OR(IS_AFTER({PostedAt}, '${seasonISO}'), AND({PostedAt}='', IS_AFTER({Created}, '${seasonISO}')))`
    );

    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&sort[0][field]=Created&sort[0][direction]=desc&maxRecords=100`;

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      throw new Error(`Airtable ${airtableRes.status}: ${err}`);
    }

    const data    = await airtableRes.json();
    const records = (data.records || []).map(r => ({ id: r.id, ...r.fields }));

    return res.status(200).json({
      records,
      season:      SEASON_NAME,
      seasonStart: SEASON_START,
      lastUpdated: new Date().toISOString(),
      count:       records.length,
    });

  } catch (err) {
    console.error('Airtable fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
