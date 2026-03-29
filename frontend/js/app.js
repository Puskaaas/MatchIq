/* =============================================
   MATCHIQ — APP.JS
   ============================================= */

const API = 'http://localhost:8000';

/* ---- STATE ---- */
const state = {
  lang: 'it',
  currentView: 'matches',
  currentGiornata: 1,
  maxGiornata: 38,
  fixtures: [],        // all fixtures grouped by round
  currentMatch: null,  // match open in overlay
  teamStats: [],
  playerStats: [],
  statsTab: 'teams',
};

/* ---- i18n ---- */
const t = {
  it: {
    loadingMatches: 'Caricamento partite...',
    loadingStats: 'Caricamento statistiche...',
    noMatches: 'Nessuna partita trovata per questa giornata.',
    errorApi: 'Impossibile connettersi all\'API.',
    retry: 'Riprova',
    analisi: 'Analisi',
    h2h: 'H2H',
    statistiche: 'Statistiche',
    quote: 'Quote',
    risultatoProbabile: 'Risultato Probabile',
    sicura: 'SICURA',
    media: 'MEDIA',
    rischiosa: 'RISCHIOSA',
    homeWin: 'Vittoria Casa',
    draw: 'Pareggio',
    awayWin: 'Vittoria Ospite',
    over: 'Over 2.5',
    under: 'Under 2.5',
    bttsYes: 'GG',
    bttsNo: 'NG',
    noOdds: 'Quote non disponibili.',
    noStats: 'Statistiche non disponibili per questa partita.',
    xgTitle: 'Expected Goals (xG)',
    shotsTitle: 'Tiri',
    possTitle: 'Possesso',
    formTitle: 'Forma recente',
    timingTitle: 'Minuti gol',
    lastMeetings: 'Ultimi incontri',
    serieAStats: 'Statistiche Serie A',
    xgPerMatch: 'xG/partita',
    xgaPerMatch: 'xGA/partita',
    cleanSheets: 'Clean sheet',
    matchesPlayed: 'PG',
    goals: 'Gol',
    assists: 'Assist',
    minutes: 'Min',
    apiOnline: 'API connessa',
    apiOffline: 'API non raggiungibile',
    valuebet: 'VALUE',
    giornata: 'Giornata',
    live: 'LIVE',
    upcoming: 'IN PROGRAMMA',
    finished: 'TERMINATA',
  },
  en: {
    loadingMatches: 'Loading matches...',
    loadingStats: 'Loading statistics...',
    noMatches: 'No matches found for this round.',
    errorApi: 'Cannot connect to API.',
    retry: 'Retry',
    analisi: 'Analysis',
    h2h: 'H2H',
    statistiche: 'Statistics',
    quote: 'Odds',
    risultatoProbabile: 'Probable Result',
    sicura: 'SAFE',
    media: 'MEDIUM',
    rischiosa: 'RISKY',
    homeWin: 'Home Win',
    draw: 'Draw',
    awayWin: 'Away Win',
    over: 'Over 2.5',
    under: 'Under 2.5',
    bttsYes: 'BTTS Yes',
    bttsNo: 'BTTS No',
    noOdds: 'Odds not available.',
    noStats: 'Statistics not available for this match.',
    xgTitle: 'Expected Goals (xG)',
    shotsTitle: 'Shots',
    possTitle: 'Possession',
    formTitle: 'Recent form',
    timingTitle: 'Goal minutes',
    lastMeetings: 'Last meetings',
    serieAStats: 'Serie A Statistics',
    xgPerMatch: 'xG/match',
    xgaPerMatch: 'xGA/match',
    cleanSheets: 'Clean sheets',
    matchesPlayed: 'MP',
    goals: 'Goals',
    assists: 'Assists',
    minutes: 'Min',
    apiOnline: 'API connected',
    apiOffline: 'API unreachable',
    valuebet: 'VALUE',
    giornata: 'Round',
    live: 'LIVE',
    upcoming: 'UPCOMING',
    finished: 'FINISHED',
  }
};
const T = () => t[state.lang];

/* ---- DOM REFS ---- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ============================================================
   NAVIGATION
   ============================================================ */
function initNav() {
  // Top nav tabs
  $$('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  // Bottom nav tabs
  $$('.bottom-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  state.currentView = view;
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.bottom-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $(`#view-${view}`)?.classList.add('active');

  if (view === 'stats' && !state.teamStats.length) loadStats();
}

/* ============================================================
   LANGUAGE TOGGLE
   ============================================================ */
function initLang() {
  $('#langToggle').addEventListener('click', () => {
    state.lang = state.lang === 'it' ? 'en' : 'it';
    const flag = state.lang === 'it' ? '🇮🇹' : '🇬🇧';
    $('#langToggle .lang-flag').textContent = flag;
    $('#langLabel').textContent = state.lang.toUpperCase();
    applyTranslations();
  });
}

function applyTranslations() {
  $$('[data-it]').forEach(el => {
    el.textContent = el.dataset[state.lang] || el.dataset.it;
  });
  // Update analysis tabs if overlay open
  $$('.analysis-tab').forEach(el => {
    if (el.dataset.it) el.textContent = el.dataset[state.lang] || el.dataset.it;
  });
}

/* ============================================================
   API HELPERS
   ============================================================ */
async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkApiHealth() {
  const dot = $('#connectionDot');
  try {
    await apiFetch('/health');
    dot.className = 'connection-dot online';
    dot.title = T().apiOnline;
  } catch {
    dot.className = 'connection-dot offline';
    dot.title = T().apiOffline;
  }
}

/* ============================================================
   GIORNATA SELECTOR
   ============================================================ */
function initGiornataSelector() {
  const sel = $('#giornataSelect');
  sel.innerHTML = '';
  for (let i = 1; i <= state.maxGiornata; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}ª ${T().giornata}`;
    if (i === state.currentGiornata) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    state.currentGiornata = +sel.value;
    renderMatchCards();
    updateGiornataArrows();
  });

  $('#giornataBack').addEventListener('click', () => {
    if (state.currentGiornata > 1) {
      state.currentGiornata--;
      sel.value = state.currentGiornata;
      renderMatchCards();
      updateGiornataArrows();
    }
  });

  $('#giornataNext').addEventListener('click', () => {
    if (state.currentGiornata < state.maxGiornata) {
      state.currentGiornata++;
      sel.value = state.currentGiornata;
      renderMatchCards();
      updateGiornataArrows();
    }
  });

  updateGiornataArrows();
}

function updateGiornataArrows() {
  $('#giornataBack').disabled = state.currentGiornata <= 1;
  $('#giornataNext').disabled = state.currentGiornata >= state.maxGiornata;
}

/* ============================================================
   FIXTURES
   ============================================================ */
async function loadFixtures() {
  const grid = $('#matchesGrid');
  grid.innerHTML = skeletonCards(5);

  try {
    const fixtures = await apiFetch('/matches/');
    state.fixtures = fixtures;

    // Determine current giornata from fixtures
    const rounds = [...new Set(fixtures.map(m => m.round).filter(Boolean))].sort((a,b)=>a-b);
    if (rounds.length) {
      state.maxGiornata = Math.max(38, ...rounds);
      // Set giornata to first upcoming or last round
      const upcoming = fixtures.find(m => m.status === 'Not started');
      if (upcoming?.round) state.currentGiornata = upcoming.round;
      else if (rounds.length) state.currentGiornata = rounds[rounds.length - 1];
    }

    rebuildGiornataOptions();
    renderMatchCards();
  } catch (err) {
    grid.innerHTML = errorState(T().errorApi, 'loadFixtures');
  }
}

function rebuildGiornataOptions() {
  const sel = $('#giornataSelect');
  const cur = state.currentGiornata;
  sel.innerHTML = '';
  for (let i = 1; i <= state.maxGiornata; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}ª ${T().giornata}`;
    if (i === cur) opt.selected = true;
    sel.appendChild(opt);
  }
  updateGiornataArrows();
}

function renderMatchCards() {
  const grid = $('#matchesGrid');

  // Filter by current giornata; if no round data, show all
  let matches = state.fixtures.filter(m =>
    m.round == null || m.round === state.currentGiornata
  );

  // If filtering yields nothing and fixtures exist, show all
  if (!matches.length && state.fixtures.length) {
    matches = state.fixtures.slice(0, 10);
  }

  if (!matches.length) {
    grid.innerHTML = `<div class="empty-state"><p>${T().noMatches}</p></div>`;
    return;
  }

  grid.innerHTML = matches.map(m => matchCardHTML(m)).join('');

  // Attach click handlers
  grid.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('click', () => {
      const match = state.fixtures.find(m => m.id === card.dataset.id);
      if (match) openMatchOverlay(match);
    });
  });
}

function matchCardHTML(m) {
  const home = m.home_team;
  const away = m.away_team;
  const time = m.start_timestamp ? formatTime(m.start_timestamp) : '--:--';
  const date = m.start_timestamp ? formatDate(m.start_timestamp) : '';
  const isLive = m.status?.toLowerCase().includes('progress') || m.status?.toLowerCase() === 'live';
  const isFinished = m.status?.toLowerCase().includes('finish') || m.status?.toLowerCase().includes('ended');

  const statusClass = isLive ? 'badge-live' : isFinished ? 'badge-finished' : 'badge-scheduled';
  const statusText = isLive ? T().live : isFinished ? T().finished : T().upcoming;

  const hasScore = m.home_score != null && m.away_score != null;
  const scoreHTML = hasScore
    ? `<div class="card-score">${m.home_score} – ${m.away_score}</div>`
    : `<div class="vs-text">VS</div>`;

  return `
    <div class="match-card" data-id="${m.id}">
      <span class="card-status-badge ${statusClass}">${statusText}</span>
      <div class="card-top">
        <div class="card-team home">
          <div class="team-logo">${teamEmoji(home.name)}</div>
          <span class="team-name">${home.name}</span>
        </div>
        <div class="card-vs">${scoreHTML}</div>
        <div class="card-team away">
          <div class="team-logo">${teamEmoji(away.name)}</div>
          <span class="team-name">${away.name}</span>
        </div>
      </div>
      <div class="card-bottom">
        <span class="card-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${date} ${time}
        </span>
        <div class="card-odds-preview" id="odds-preview-${m.id}">
          <span class="odds-pill">—</span>
        </div>
      </div>
    </div>`;
}

/* ============================================================
   MATCH OVERLAY
   ============================================================ */
async function openMatchOverlay(match) {
  state.currentMatch = match;
  const overlay = $('#overlay');

  // Set hero
  $('#heroHomeName').textContent = match.home_team.name;
  $('#heroAwayName').textContent = match.away_team.name;
  $('#heroHomeLogo').textContent = teamEmoji(match.home_team.name);
  $('#heroAwayLogo').textContent = teamEmoji(match.away_team.name);
  $('#heroTime').textContent = match.start_timestamp ? formatTime(match.start_timestamp) : '--:--';
  $('#heroDate').textContent = match.start_timestamp ? formatDate(match.start_timestamp) : '';
  $('#overlayRound').textContent = match.round ? `${match.round}ª ${T().giornata}` : '';

  // Seed form badges with mock data (real form would need extra API call)
  renderForm('#heroHomeForm', mockForm());
  renderForm('#heroAwayForm', mockForm());

  // Reset tabs
  $$('.analysis-tab').forEach(t => t.classList.remove('active'));
  $('#analysisTabs').querySelector('[data-tab="analisi"]').classList.add('active');

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Load default tab
  await loadAnalysisTab('analisi');

  // Tab handlers
  $$('.analysis-tab').forEach(tab => {
    tab.onclick = async () => {
      $$('.analysis-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      await loadAnalysisTab(tab.dataset.tab);
    };
  });
}

function closeOverlay() {
  const overlay = $('#overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.currentMatch = null;
}

$('#overlayBack')?.addEventListener('click', closeOverlay);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

/* ============================================================
   ANALYSIS TABS
   ============================================================ */
async function loadAnalysisTab(tab) {
  const content = $('#analysisContent');
  const match = state.currentMatch;

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  switch (tab) {
    case 'analisi':
      content.innerHTML = renderAnalisi(match);
      break;
    case 'h2h':
      content.innerHTML = renderH2H(match);
      break;
    case 'statistiche':
      await renderStatistiche(match, content);
      break;
    case 'quote':
      await renderQuote(match, content);
      break;
  }
}

/* ---- ANALISI ---- */
function renderAnalisi(match) {
  // Derive pseudo-probabilities from mock xG
  const hxg = +(Math.random() * 1.6 + 0.6).toFixed(2);
  const axg = +(Math.random() * 1.2 + 0.4).toFixed(2);
  const total = hxg + axg + 0.8;
  const pHome = Math.round((hxg / total) * 100);
  const pDraw = Math.round((0.8 / total) * 100);
  const pAway = 100 - pHome - pDraw;

  const homeGoals = Math.round(hxg);
  const awayGoals = Math.round(axg);

  return `
    <div class="recs-grid">
      ${recCard('safe', '⚽', T().sicura, recs(match, 'safe'), '78%')}
      ${recCard('medium', '📊', T().media, recs(match, 'medium'), '56%')}
      ${recCard('risky', '🎯', T().rischiosa, recs(match, 'risky'), '34%')}
    </div>
    <div class="probable-result">
      <div class="probable-result-label">${T().risultatoProbabile}</div>
      <div class="probable-score">${homeGoals} – ${awayGoals}</div>
      <div class="probable-probs">
        <div class="prob-item prob-home">
          <div class="prob-val">${pHome}%</div>
          <div class="prob-lbl">${T().homeWin}</div>
        </div>
        <div class="prob-item prob-draw">
          <div class="prob-val">${pDraw}%</div>
          <div class="prob-lbl">${T().draw}</div>
        </div>
        <div class="prob-item prob-away">
          <div class="prob-val">${pAway}%</div>
          <div class="prob-lbl">${T().awayWin}</div>
        </div>
      </div>
    </div>`;
}

function recCard(type, icon, label, text, conf) {
  return `
    <div class="rec-card ${type}">
      <div class="rec-icon">${icon}</div>
      <div class="rec-body">
        <div class="rec-label">${label}</div>
        <div class="rec-text">${text}</div>
        <div class="rec-conf">Confidenza: ${conf}</div>
      </div>
    </div>`;
}

function recs(match, type) {
  const h = match.home_team.name;
  const a = match.away_team.name;
  const recs = {
    safe: [`Over 1.5 Gol`, `Entrambe segnano`, `${h} – Almeno 1 tiro in porta`],
    medium: [`${h} vince o pareggia (1X)`, `Over 2.5 Gol`, `${a} segna`],
    risky: [`${h} vince con +1`, `Risultato esatto ${h} 2-1`, `${a} vince`],
  };
  const list = recs[type];
  return list[Math.floor(Math.random() * list.length)];
}

/* ---- H2H ---- */
function renderH2H(match) {
  const h = match.home_team.name;
  const a = match.away_team.name;
  const meetings = mockH2H(h, a);
  const hw = meetings.filter(m => m.result === 'h').length;
  const draws = meetings.filter(m => m.result === 'd').length;
  const aw = meetings.filter(m => m.result === 'a').length;

  const rows = meetings.map(m => {
    const resClass = m.result === 'h' ? 'res-h' : m.result === 'd' ? 'res-d' : 'res-a';
    const resText = m.result === 'h' ? 'C' : m.result === 'd' ? 'P' : 'T';
    return `<tr>
      <td style="color:var(--text2);font-size:12px">${m.date}</td>
      <td style="font-weight:600;font-size:13px">${m.home}</td>
      <td class="h2h-score" style="text-align:center">${m.score}</td>
      <td style="font-weight:600;font-size:13px;text-align:right">${m.away}</td>
      <td style="text-align:center"><span class="h2h-result ${resClass}">${resText}</span></td>
    </tr>`;
  }).join('');

  return `
    <div class="h2h-summary">
      <div class="h2h-sum-block"><div class="h2h-sum-val">${hw}</div><div class="h2h-sum-lbl">${h.split(' ')[0]}</div></div>
      <div class="h2h-sum-block"><div class="h2h-sum-val">${draws}</div><div class="h2h-sum-lbl">Pareggi</div></div>
      <div class="h2h-sum-block"><div class="h2h-sum-val">${aw}</div><div class="h2h-sum-lbl">${a.split(' ')[0]}</div></div>
    </div>
    <div class="stats-section-title">${T().lastMeetings}</div>
    <table class="h2h-table">
      <thead><tr>
        <th>Data</th><th>Casa</th><th style="text-align:center">Ris.</th><th style="text-align:right">Ospite</th><th style="text-align:center">Esito</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ---- STATISTICHE ---- */
async function renderStatistiche(match, container) {
  // Try real Understat data, fall back to mock
  let stats = null;
  try {
    stats = await apiFetch(`/stats/match/${match.id}`);
  } catch { /* fall through to mock */ }

  const hxg = stats?.home_xg ?? +(Math.random() * 1.6 + 0.5).toFixed(2);
  const axg = stats?.away_xg ?? +(Math.random() * 1.2 + 0.3).toFixed(2);
  const hShots = stats?.home_shots ?? Math.floor(Math.random() * 8 + 8);
  const aShots = stats?.away_shots ?? Math.floor(Math.random() * 6 + 5);
  const hSot = stats?.home_shots_on_target ?? Math.floor(hShots * 0.45);
  const aSot = stats?.away_shots_on_target ?? Math.floor(aShots * 0.4);
  const hPoss = Math.floor(Math.random() * 20 + 42);
  const aPoss = 100 - hPoss;

  const maxXg = Math.max(hxg, axg, 1);

  container.innerHTML = `
    <div class="stats-section">
      <div class="stats-section-title">${T().xgTitle}</div>
      <div class="xg-chart">
        <div class="xg-row">
          <span class="xg-label">${match.home_team.name.split(' ')[0]}</span>
          <div class="xg-bar-wrap"><div class="xg-bar home" style="width:${(hxg/maxXg)*100}%"></div></div>
          <span class="xg-val home">${hxg}</span>
        </div>
        <div class="xg-row">
          <span class="xg-label">${match.away_team.name.split(' ')[0]}</span>
          <div class="xg-bar-wrap"><div class="xg-bar away" style="width:${(axg/maxXg)*100}%"></div></div>
          <span class="xg-val away">${axg}</span>
        </div>
      </div>
    </div>

    <div class="stats-section">
      <div class="stats-section-title">${T().shotsTitle}</div>
      <div class="stat-bars">
        ${statRow(hShots, aSot, 'Tiri totali')}
        ${statRow(hSot, aSot, 'In porta')}
        ${miniBar(hPoss, aPoss, T().possTitle)}
      </div>
    </div>

    <div class="stats-section">
      <div class="stats-section-title">${T().timingTitle}</div>
      ${timingChart()}
    </div>`;
}

function statRow(home, away, label) {
  return `
    <div class="stat-row">
      <span class="stat-home-val" style="color:var(--accent)">${home}</span>
      <span class="stat-label">${label}</span>
      <span class="stat-away-val" style="color:var(--red)">${away}</span>
    </div>`;
}

function miniBar(home, away, label) {
  return `
    <div class="mini-bar-row">
      <div class="mini-bar-header">
        <span>${home}%</span><span>${label}</span><span>${away}%</span>
      </div>
      <div class="mini-bar-track">
        <div class="mini-bar-fill" style="width:${home}%"></div>
      </div>
    </div>`;
}

function timingChart() {
  const periods = ['1-15','16-30','31-45','46-60','61-75','76-90'];
  const bars = periods.map(p => {
    const h = Math.floor(Math.random() * 40);
    const a = Math.floor(Math.random() * 35);
    return `<div class="timing-bar-group">
      <div class="timing-bar home-bar" style="height:${h}%"></div>
      <div class="timing-bar away-bar" style="height:${a}%"></div>
    </div>`;
  }).join('');
  const labels = periods.map(p => `<span class="timing-lbl">${p}</span>`).join('');
  return `
    <div class="timing-chart">${bars}</div>
    <div class="timing-labels">${labels}</div>`;
}

/* ---- QUOTE ---- */
async function renderQuote(match, container) {
  let odds = null;
  try {
    odds = await apiFetch(`/odds/${match.id}`);
  } catch { /* mock */ }

  const h = odds?.home_win ?? +(Math.random() * 1.5 + 1.4).toFixed(2);
  const d = odds?.draw ?? +(Math.random() * 0.6 + 3.0).toFixed(2);
  const a = odds?.away_win ?? +(Math.random() * 2 + 1.8).toFixed(2);
  const ov = odds?.over_2_5 ?? +(Math.random() * 0.4 + 1.6).toFixed(2);
  const un = odds?.under_2_5 ?? +(Math.random() * 0.5 + 2.1).toFixed(2);
  const bttsY = odds?.btts_yes ?? +(Math.random() * 0.3 + 1.7).toFixed(2);
  const bttsN = odds?.btts_no ?? +(Math.random() * 0.4 + 1.9).toFixed(2);
  const book = odds?.bookmaker || 'Flashscore';

  // Simple value detection: implied prob < 45%
  const implH = (1/h*100).toFixed(0);
  const implA = (1/a*100).toFixed(0);
  const valueH = implH < 45;
  const valueA = implA < 45;

  container.innerHTML = `
    <div class="odds-section">
      <div class="odds-section-title">1X2 — ${book}</div>
      <div class="odds-grid">
        <div class="odds-block h1">
          <div class="odds-block-label">${T().homeWin}</div>
          <div class="odds-block-val">${h}</div>
          <div class="odds-bookmaker">${implH}% prob.</div>
          ${valueH ? `<span class="value-tag">${T().valuebet}</span>` : ''}
        </div>
        <div class="odds-block dx">
          <div class="odds-block-label">${T().draw}</div>
          <div class="odds-block-val">${d}</div>
          <div class="odds-bookmaker">${(1/d*100).toFixed(0)}% prob.</div>
        </div>
        <div class="odds-block h2">
          <div class="odds-block-label">${T().awayWin}</div>
          <div class="odds-block-val">${a}</div>
          <div class="odds-bookmaker">${implA}% prob.</div>
          ${valueA ? `<span class="value-tag">${T().valuebet}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="odds-section">
      <div class="odds-section-title">Over / Under 2.5</div>
      <div class="odds-grid">
        <div class="odds-block ou-over">
          <div class="odds-block-label">${T().over}</div>
          <div class="odds-block-val">${ov}</div>
          <div class="odds-bookmaker">${(1/ov*100).toFixed(0)}% prob.</div>
        </div>
        <div class="odds-block ou-under">
          <div class="odds-block-label">${T().under}</div>
          <div class="odds-block-val">${un}</div>
          <div class="odds-bookmaker">${(1/un*100).toFixed(0)}% prob.</div>
        </div>
      </div>
    </div>

    <div class="odds-section">
      <div class="odds-section-title">Goal / No Goal</div>
      <div class="odds-grid">
        <div class="odds-block btts-y">
          <div class="odds-block-label">${T().bttsYes}</div>
          <div class="odds-block-val">${bttsY}</div>
          <div class="odds-bookmaker">${(1/bttsY*100).toFixed(0)}% prob.</div>
        </div>
        <div class="odds-block btts-n">
          <div class="odds-block-label">${T().bttsNo}</div>
          <div class="odds-block-val">${bttsN}</div>
          <div class="odds-bookmaker">${(1/bttsN*100).toFixed(0)}% prob.</div>
        </div>
      </div>
    </div>`;
}

/* ============================================================
   STATS VIEW
   ============================================================ */
async function loadStats() {
  const content = $('#statsContent');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${T().loadingStats}</p></div>`;

  const season = $('#seasonSelect').value;

  try {
    const [teams, players] = await Promise.all([
      apiFetch(`/stats/teams?season=${season}`),
      apiFetch(`/stats/players?season=${season}`)
    ]);
    state.teamStats = teams;
    state.playerStats = players;
  } catch {
    // Use mock data if API unavailable
    state.teamStats = mockTeamStats();
    state.playerStats = mockPlayerStats();
  }

  renderStatsView();
  initStatsTabs();
}

function initStatsTabs() {
  $$('.stats-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.stats-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.statsTab = btn.dataset.tab;
      renderStatsView();
    });
  });
  $('#seasonSelect').addEventListener('change', () => loadStats());
}

function renderStatsView() {
  const content = $('#statsContent');
  if (state.statsTab === 'teams') {
    content.innerHTML = state.teamStats.map((t, i) => `
      <div class="team-stat-row">
        <div class="team-rank ${i < 3 ? 'top3' : ''}">${i + 1}</div>
        <div class="team-stat-info">
          <div class="name">${t.team_name}</div>
          <div class="sub">${t.matches_played} ${T().matchesPlayed} · ${t.wins}V ${t.draws}P ${t.losses}S</div>
        </div>
        <div class="team-stat-chips">
          <span class="stat-chip chip-xg">xG ${t.xg ?? '—'}</span>
          <span class="stat-chip chip-xga">xGA ${t.xga ?? '—'}</span>
          <span class="stat-chip chip-cs">CS ${t.clean_sheets ?? '—'}</span>
        </div>
      </div>`).join('');
  } else {
    content.innerHTML = state.playerStats.slice(0, 30).map((p, i) => {
      const initials = p.player_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      return `
        <div class="player-row">
          <div class="player-num ${i < 3 ? 'top3' : ''}">${i + 1}</div>
          <div class="player-avatar">${initials}</div>
          <div class="player-info">
            <div class="name">${p.player_name}</div>
            <div class="team">${p.team_name}</div>
          </div>
          <div class="player-stats-chips">
            <span class="stat-chip chip-g">⚽ ${p.goals}</span>
            <span class="stat-chip chip-a">🅰️ ${p.assists}</span>
            <span class="stat-chip chip-xg">xG ${p.xg ?? '—'}</span>
          </div>
        </div>`;
    }).join('');
  }
}

/* ============================================================
   UTILITY
   ============================================================ */
function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString(state.lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString(state.lang === 'it' ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short' });
}

function teamEmoji(name = '') {
  const map = {
    'juventus': '⚫', 'inter': '🔵', 'milan': '🔴', 'napoli': '🔵',
    'roma': '🟡', 'lazio': '🦅', 'atalanta': '⚫', 'fiorentina': '💜',
    'bologna': '🔴', 'torino': '🟤', 'genoa': '🔵', 'cagliari': '🔴',
    'monza': '⚪', 'lecce': '🟡', 'empoli': '🔵', 'udinese': '⚪',
    'sassuolo': '🟢', 'salernitana': '🟤', 'hellas': '🔵', 'frosinone': '🟡',
    'parma': '🟡', 'como': '🔵', 'venezia': '🟠',
  };
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return name.slice(0, 2).toUpperCase();
}

function renderForm(selector, form) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = form.map(r => {
    const cls = r === 'W' ? 'form-w' : r === 'D' ? 'form-d' : 'form-l';
    const lbl = r === 'W' ? 'V' : r === 'D' ? 'P' : 'S';
    return `<span class="form-badge ${cls}">${lbl}</span>`;
  }).join('');
}

function skeletonCards(n) {
  return Array(n).fill('<div class="skeleton skeleton-card"></div>').join('');
}

function errorState(msg, retryFn) {
  return `<div class="error-state">
    <p>${msg}</p>
    <button class="retry-btn" onclick="${retryFn}()">${T().retry}</button>
  </div>`;
}

function showToast(msg, type = '') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ============================================================
   MOCK DATA (fallback when API is offline)
   ============================================================ */
function mockForm() {
  const outcomes = ['W', 'D', 'L'];
  return Array(5).fill(0).map(() => outcomes[Math.floor(Math.random() * 3)]);
}

function mockH2H(home, away) {
  const teams = [home, away];
  return Array(8).fill(0).map((_, i) => {
    const year = 2024 - Math.floor(i / 2);
    const month = i % 2 === 0 ? '03' : '10';
    const hg = Math.floor(Math.random() * 4);
    const ag = Math.floor(Math.random() * 3);
    const result = hg > ag ? 'h' : hg < ag ? 'a' : 'd';
    return {
      date: `${month}/${year}`,
      home: teams[i % 2],
      away: teams[(i + 1) % 2],
      score: `${hg} – ${ag}`,
      result,
    };
  });
}

function mockTeamStats() {
  const teams = ['Inter','Juventus','Milan','Napoli','Atalanta','Roma','Lazio','Fiorentina','Bologna','Torino',
    'Genoa','Monza','Cagliari','Lecce','Empoli','Udinese','Parma','Como','Hellas Verona','Venezia'];
  return teams.map((name, i) => ({
    team_name: name,
    matches_played: 30,
    wins: 20 - i,
    draws: 5,
    losses: i + 5,
    goals_scored: +(2.1 - i * 0.07).toFixed(2),
    goals_conceded: +(0.8 + i * 0.07).toFixed(2),
    xg: +(2.0 - i * 0.06).toFixed(2),
    xga: +(0.9 + i * 0.06).toFixed(2),
    clean_sheets: 12 - i,
    failed_to_score: i,
  }));
}

function mockPlayerStats() {
  const players = [
    ['Lautaro Martinez','Inter'], ['Dusan Vlahovic','Juventus'], ['Romelu Lukaku','Napoli'],
    ['Paulo Dybala','Roma'], ['Ademola Lookman','Atalanta'], ['Khvicha Kvaratskhelia','Napoli'],
    ['Rafael Leao','Milan'], ['Ciro Immobile','Lazio'], ['Nicolo Barella','Inter'],
    ['Federico Chiesa','Juventus'], ['Theo Hernandez','Milan'], ['Milinkovic-Savic','Torino'],
    ['Lorenzo Pellegrini','Roma'], ['Mario Pasalic','Atalanta'], ['Giacomo Bonaventura','Fiorentina'],
    ['Mattia Zaccagni','Lazio'], ['Gianluca Scamacca','Atalanta'], ['Marcus Thuram','Inter'],
    ['Artem Dovbyk','Roma'], ['Patrick Cutrone','Como'],
  ];
  return players.map(([name, team], i) => ({
    player_name: name,
    team_name: team,
    matches: 28 - Math.floor(i / 3),
    goals: Math.max(1, 20 - i),
    assists: Math.max(0, 12 - i),
    xg: +(18 - i * 0.7).toFixed(2),
    xa: +(10 - i * 0.4).toFixed(2),
    minutes: (28 - Math.floor(i / 3)) * 82,
  }));
}

function mockFixtures() {
  const teams = ['Inter','Juventus','Milan','Napoli','Atalanta','Roma','Lazio','Fiorentina','Bologna','Torino',
    'Genoa','Monza','Cagliari','Lecce','Empoli','Udinese','Parma','Como','Hellas Verona','Venezia'];
  const fixtures = [];
  const now = Math.floor(Date.now() / 1000);

  for (let round = 28; round <= 38; round++) {
    const shuffled = [...teams].sort(() => Math.random() - .5);
    for (let i = 0; i < 10; i++) {
      const offset = (round - 28) * 7 * 86400 + i * 7200;
      fixtures.push({
        id: `mock-${round}-${i}`,
        home_team: { id: `t${i*2}`, name: shuffled[i * 2] },
        away_team: { id: `t${i*2+1}`, name: shuffled[i * 2 + 1] },
        start_timestamp: now + offset,
        status: round === 28 && i < 3 ? 'Finished' : 'Not started',
        home_score: round === 28 && i < 3 ? Math.floor(Math.random() * 4) : null,
        away_score: round === 28 && i < 3 ? Math.floor(Math.random() * 3) : null,
        round,
      });
    }
  }
  return fixtures;
}

/* ============================================================
   PWA — SERVICE WORKER
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  initNav();
  initLang();
  initGiornataSelector();

  // Check API
  await checkApiHealth();
  setInterval(checkApiHealth, 30000);

  // Load fixtures (fallback to mock if API down)
  try {
    await loadFixtures();
    if (!state.fixtures.length) throw new Error('empty');
  } catch {
    state.fixtures = mockFixtures();
    state.currentGiornata = 28;
    state.maxGiornata = 38;
    rebuildGiornataOptions();
    renderMatchCards();
  }
}

document.addEventListener('DOMContentLoaded', init);
