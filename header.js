/* ═══════════════════════════════════════════
   header.js — Shared site header
   Injects the sticky header into any page with
   a <div id="site-header"></div> placeholder.
   Relies on shared styles.css already loaded.
   ═══════════════════════════════════════════ */

(function () {
  const HEADER_HTML = `
  <header class="site-header">
    <div class="header-inner">
      <div class="header-left">
        <a href="/" class="brand-link" aria-label="Kythik home" style="display:flex;align-items:center;gap:12px;">
          <div class="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" stroke-opacity="0.6"/>
              <circle cx="12" cy="12" r="3" stroke-opacity="0.9"/>
              <path d="M12 9 L12 5 M12 19 L12 15 M9 12 L5 12 M19 12 L15 12" stroke-opacity="0.5"/>
            </svg>
          </div>
          <span class="header-name">Kythik</span>
        </a>
        <div class="live-badge" id="headerLive" style="display:none">
          <div class="live-dot"></div>
          <span>Live</span>
        </div>
      </div>
      <nav class="header-center">
        <a href="/clockwork/clockwork_calculator.html" class="header-pill">
          Clockwork
        </a>
        <a href="/arcana/arcana.html" class="header-pill">
          Arcana
        </a>
      </nav>
      <nav class="header-right">
        <a href="https://twitch.tv/kythikx" target="_blank" rel="noopener" class="icon-btn icon-btn--twitch" aria-label="Twitch" title="Twitch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
        </a>
        <a href="https://discord.gg/qDRWUM83zY" target="_blank" rel="noopener" class="icon-btn icon-btn--discord" aria-label="Discord" title="Discord">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        </a>
      </nav>
    </div>
  </header>`;

  const mount = document.getElementById('site-header');
  if (mount) {
    mount.outerHTML = HEADER_HTML;
  }

  // ── Live status check ─────────────────────
  // Pages that need live-badge updates can call
  // window.kythikUpdateLiveBadge(isLive) after
  // fetching /api/twitch themselves (avoids
  // duplicate fetches if the page already has one).
  window.kythikUpdateLiveBadge = function (isLive) {
    const hl = document.getElementById('headerLive');
    if (!hl) return;
    hl.style.display = isLive ? 'flex' : 'none';
  };

  // If no page-specific script handles it, do a default check
  if (!window.kythikSkipDefaultLiveCheck) {
    fetch('/api/twitch')
      .then(r => r.json())
      .then(data => window.kythikUpdateLiveBadge(!!data.isLive))
      .catch(() => {});
  }
})();
