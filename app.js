/* ═══════════════════════════════════════════
   KYTHIK HUB — app.js
   ═══════════════════════════════════════════ */

'use strict';

/* ── STATE ──────────────────────────────── */
let allStrategies = [];
let activeFilter  = 'all';
let activeTag     = 'all';

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

  if (isLive) {
    status.innerHTML = '<div class="live-dot"></div> Live on Twitch';
    status.className = 'live-pill';
  } else {
    status.textContent = '▶ Latest VOD';
    status.className   = 'live-pill live-pill--vod';
  }

  const iframe = document.createElement('iframe');
  iframe.src             = src;
  iframe.allowFullscreen = true;
  iframe.style.cssText   = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  player.appendChild(iframe);
}

/* ══════════════════════════════════════════
   VOTES — browser localStorage
══════════════════════════════════════════ */
function getVotes(id) {
  try {
    const stored = JSON.parse(localStorage.getItem('kh_votes') || '{}');
    return stored[id] || { up: 0, down: 0, voted: null };
  } catch { return { up: 0, down: 0, voted: null }; }
}

function saveVote(id, type) {
  try {
    const stored = JSON.parse(localStorage.getItem('kh_votes') || '{}');
    const current = stored[id] || { up: 0, down: 0, voted: null };

    if (current.voted === type) {
      // undo vote
      current[type] = Math.max(0, current[type] - 1);
      current.voted = null;
    } else {
      // remove old vote if switching
      if (current.voted) {
        current[current.voted] = Math.max(0, current[current.voted] - 1);
      }
      current[type]++;
      current.voted = type;
    }

    stored[id] = current;
    localStorage.setItem('kh_votes', JSON.stringify(stored));
    return current;
  } catch { return { up: 0, down: 0, voted: null }; }
}

function voteHTML(id, inline = false) {
  const v = getVotes(id);
  const cls = inline ? 'votes votes--inline' : 'votes';
  return `
    <div class="${cls}" data-id="${id}">
      <button class="vote-btn vote-btn--up ${v.voted === 'up' ? 'active' : ''}"
              onclick="handleVote('${id}','up',event)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
        <span class="vote-count" data-type="up">${v.up}</span>
      </button>
      <button class="vote-btn vote-btn--down ${v.voted === 'down' ? 'active' : ''}"
              onclick="handleVote('${id}','down',event)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
        <span class="vote-count" data-type="down">${v.down}</span>
      </button>
    </div>`;
}

function handleVote(id, type, e) {
  e.stopPropagation();
  const v = saveVote(id, type);

  // Update all vote UIs for this id
  document.querySelectorAll(`.votes[data-id="${id}"]`).forEach(el => {
    el.querySelector('.vote-btn--up').className  = `vote-btn vote-btn--up ${v.voted === 'up' ? 'active' : ''}`;
    el.querySelector('.vote-btn--down').className = `vote-btn vote-btn--down ${v.voted === 'down' ? 'active' : ''}`;
    el.querySelector('[data-type="up"]').textContent   = v.up;
    el.querySelector('[data-type="down"]').textContent = v.down;
  });
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
    buildTagFilters();
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

/* ── BUILD TAG FILTER PILLS ─────────────── */
function buildTagFilters() {
  const tagSet = new Set();
  allStrategies.forEach(s => {
    if (s.Tags) s.Tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
  });

  const container = document.getElementById('tagFilters');
  if (!container || !tagSet.size) return;

  container.innerHTML = [...tagSet].map(tag =>
    `<button class="pill pill--tag" data-tag="${tag}">${tag}</button>`
  ).join('');

  container.querySelectorAll('.pill--tag').forEach(btn => {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.pill--tag').forEach(b => b.classList.remove('active'));
      if (activeTag === this.dataset.tag) {
        activeTag = 'all';
      } else {
        this.classList.add('active');
        activeTag = this.dataset.tag;
      }
      applyFilters();
    });
  });
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

  grid.innerHTML = list.map(s => {
    const initial  = (s.Author || '?')[0].toUpperCase();
    const dateStr  = s.Created
      ? new Date(s.Created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const tags     = s.Tags
      ? s.Tags.split(',').map(t => t.trim()).filter(Boolean)
          .map(t => `<span class="tag">${t}</span>`).join('')
      : '';
    const hasImg   = s.ImageUrls && s.ImageUrls.trim();
    const imgThumb = hasImg
      ? `<div class="card-thumb"><img src="${s.ImageUrls.split(',')[0].trim()}" alt="Strategy screenshot" loading="lazy" /></div>`
      : '';

    return `
      <article class="card" data-id="${s.id}" onclick="openModal('${s.id}')">
        ${imgThumb}
        <div class="card-inner">
          <div class="card-top">
            <div class="card-tags">
              ${s.Channel ? `<span class="tag tag--channel">${s.Channel}</span>` : ''}
              ${tags}
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
            <div class="card-foot-right">
              ${s.CommentCount ? `<a class="comment-count" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">💬 ${s.CommentCount}</a>` : ''}
              ${voteHTML(s.id, true)}
            </div>
          </div>
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

  if (activeTag !== 'all') {
    filtered = filtered.filter(s =>
      s.Tags && s.Tags.split(',').map(t => t.trim()).includes(activeTag)
    );
  }

  if (query) {
    filtered = filtered.filter(s =>
      [s.Title, s.Body, s.Author, s.Channel, s.Tags]
        .some(v => (v || '').toLowerCase().includes(query))
    );
  }

  renderStrategies(filtered);
}

document.getElementById('searchInput').addEventListener('input', applyFilters);

document.querySelectorAll('.pill[data-filter]').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.pill[data-filter]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    activeFilter = this.dataset.filter;
    applyFilters();
  });
});

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function openModal(id) {
  const s = allStrategies.find(x => x.id === id);
  if (!s) return;

  const dateStr = s.Created
    ? new Date(s.Created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const tags = s.Tags
    ? s.Tags.split(',').map(t => t.trim()).filter(Boolean)
        .map(t => `<span class="tag">${t}</span>`).join('')
    : '';

  const images = s.ImageUrls
    ? s.ImageUrls.split(',').map(u => u.trim()).filter(Boolean)
        .map(u => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Strategy screenshot" /></a>`)
        .join('')
    : '';

  const discordBtn = s.DiscordMessageURL
    ? `<a class="modal-discord-btn" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        View in Discord
       </a>`
    : '';

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-head">
      <div class="modal-tags">
        ${s.Channel ? `<span class="tag tag--channel">${s.Channel}</span>` : ''}
        ${tags}
      </div>
      <button class="modal-close" onclick="closeModal()" aria-label="Close">✕</button>
    </div>
    <h2 class="modal-title">${s.Title || 'Untitled'}</h2>
    <div class="modal-meta">
      <div class="author">
        <div class="avatar">${(s.Author || '?')[0].toUpperCase()}</div>
        ${s.Author || 'Anonymous'}
      </div>
      <span class="card-date">${dateStr}</span>
    </div>
    <div class="modal-body">${(s.Body || '').replace(/\n/g, '<br>')}</div>
    ${images ? `<div class="modal-images">${images}</div>` : ''}
    <div class="modal-foot">
      ${s.CommentCount ? `<a class="comment-count" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">💬 ${s.CommentCount} comments in Discord</a>` : ''}
      ${voteHTML(s.id)}
      ${discordBtn}
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Close on overlay click
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ── TOAST ──────────────────────────────── */
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type || ''}`;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 4500);
}

/* ── INIT ───────────────────────────────── */
initTwitchPlayer();
fetchStrategies();
