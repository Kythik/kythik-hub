/* ═══════════════════════════════════════════
   KYTHIK HUB — app.js
   ═══════════════════════════════════════════ */

'use strict';

/* ── STATE ──────────────────────────────── */
let allStrategies = [];
let activeFilter  = 'all';

/* ══════════════════════════════════════════
   TWITCH — live check + player inject
══════════════════════════════════════════ */
async function initTwitchPlayer() {
  const player = document.getElementById('twitchPlayer');
  const status = document.getElementById('streamStatus');
  const base   = `https://player.twitch.tv/?parent=${CONFIG.VERCEL_DOMAIN}&autoplay=true`;

  let src;
  let isLive = false;

  try {
    const res  = await fetch('/api/twitch');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    isLive     = data.isLive;

    if (isLive) {
      src = `${base}&channel=${CONFIG.TWITCH_CHANNEL}`;
    } else if (data.vodId) {
      src = `${base}&video=${data.vodId}`;
    } else {
      src = `${base}&channel=${CONFIG.TWITCH_CHANNEL}`;
    }
  } catch (err) {
    console.warn('Twitch API check failed, falling back to channel embed.', err);
    src = `${base}&channel=${CONFIG.TWITCH_CHANNEL}`;
  }

  // Update status pill
  if (isLive) {
    status.innerHTML = '<div class="live-dot"></div> Live on Twitch';
    status.className = 'live-pill';
  } else {
    status.textContent = '▶ Latest VOD';
    status.className   = 'live-pill live-pill--vod';
  }

  // Inject iframe
  const iframe = document.createElement('iframe');
  iframe.src             = src;
  iframe.allowFullscreen = true;
  iframe.style.cssText   = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  player.appendChild(iframe);
}

/* ══════════════════════════════════════════
   AIRTABLE — fetch strategies via serverless
══════════════════════════════════════════ */
async function fetchStrategies() {
  try {
    const res = await fetch('/api/airtable');
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    allStrategies = data.records || [];
    applyFilters();

  } catch (err) {
    console.error('Strategy fetch failed:', err);
    document.getElementById('stratGrid').innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">⚠</div>
        <p>Couldn't load strategies. Try refreshing.</p>
      </div>`;
    document.getElementById('stratCount').textContent = '—';
  }
}

/* ── RENDER ─────────────────────────────── */
function renderStrategies(list) {
  const grid = document.getElementById('stratGrid');
  document.getElementById('stratCount').textContent =
    `${list.length} strateg${list.length === 1 ? 'y' : 'ies'}`;

  if (!list.length) {
    grid.innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">📜</div>
        <p>No strategies yet — post one in Discord to get things started.</p>
      </div>`;
    return;
  }

  const discordIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`;

  grid.innerHTML = list.map(s => {
    const initial    = (s.Author || '?')[0].toUpperCase();
    const dateStr    = s.Created
      ? new Date(s.Created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const discordBtn = s.DiscordMessageURL
      ? `<a class="discord-link" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">${discordIcon} View in Discord</a>`
      : '';
    const channelTag = s.Channel
      ? `<span class="tag tag--channel">${s.Channel}</span>`
      : '';

    return `
      <article class="card" data-channel="${s.Channel || ''}">
        <div class="card-top">
          <div class="card-tags">
            ${channelTag}
            ${s.BuildType ? `<span class="tag">${s.BuildType}</span>` : ''}
          </div>
          <span class="card-date">${dateStr}</span>
        </div>
        <h2 class="card-title">${s.Title || 'Untitled'}</h2>
        <p class="card-body">${s.Body || ''}</p>
        <div class="card-foot">
          <div class="author">
            <div class="avatar" aria-hidden="true">${initial}</div>
            ${s.Author || 'Anonymous'}
          </div>
          ${discordBtn}
        </div>
      </article>`;
  }).join('');
}

/* ── FILTER ─────────────────────────────── */
function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = allStrategies;

  if (activeFilter !== 'all') {
    filtered = filtered.filter(s => s.Channel === activeFilter);
  }

  if (query) {
    filtered = filtered.filter(s =>
      [s.Title, s.Body, s.Author, s.Channel]
        .some(v => (v || '').toLowerCase().includes(query))
    );
  }

  renderStrategies(filtered);
}

document.getElementById('searchInput').addEventListener('input', applyFilters);

document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    activeFilter = this.dataset.filter;
    applyFilters();
  });
});

/* ── INIT ───────────────────────────────── */
initTwitchPlayer();
fetchStrategies();
