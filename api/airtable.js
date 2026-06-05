/* ═══════════════════════════════════════════
   api/airtable.js — Vercel serverless function
   Returns strategies from Airtable.
   Credentials never exposed to the browser.
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  const TOKEN  = process.env.AIRTABLE_TOKEN;
  const BASE   = process.env.AIRTABLE_BASE;
  const TABLE  = 'Strategies';

  if (!TOKEN || !BASE) {
    return res.status(500).json({ error: 'Missing Airtable credentials in environment.' });
  }

  try {
    const url = [
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`,
      '?sort[0][field]=Created',
      '&sort[0][direction]=desc',
      '&maxRecords=60'
    ].join('');

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (!airtableRes.ok) throw new Error(`Airtable ${airtableRes.status}`);

    const data = await airtableRes.json();
    const records = (data.records || []).map(r => ({ id: r.id, ...r.fields }));

    return res.status(200).json({ records });

  } catch (err) {
    console.error('Airtable fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
