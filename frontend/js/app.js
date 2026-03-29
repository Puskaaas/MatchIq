/* =============================================
   MATCHIQ — APP.JS  (real data edition)
   ============================================= */

const API = 'http://localhost:8000';

/* ── STATE ─────────────────────────────────────────────────────────────── */
const state = {
  lang: 'it',
  currentView: 'matches',
  currentGiornata: 1,
  maxGiornata: 38,
  fixtures: [],
  currentMatch: null,
  currentAnalysis: null,   // cached /analyze response
  teamStats: [],
  playerStats: [],
  statsTab: 'teams',
};

/* ── i18n ──────────────────────────────────────────────────────────────── */
const T_DATA = {
  it: {
    loadingMatches:'Caricamento partite...', loadingStats:'Caricamento statistiche...',
    loadingAnalysis:'Caricamento analisi...', noMatches:'Nessuna partita per questa giornata.',
    errorApi:'Impossibile connettersi all\'API.', retry:'Riprova',
    analisi:'Analisi', h2h:'H2H', statistiche:'Statistiche', quote:'Quote',
    risultatoProbabile:'Risultato Probabile', sicura:'SICURA', media:'MEDIA', rischiosa:'RISCHIOSA',
    homeWin:'Vittoria Casa', draw:'Pareggio', awayWin:'Vittoria Ospite',
    over:'Over 2.5', under:'Under 2.5', bttsYes:'GG', bttsNo:'NG',
    noOdds:'Quote non disponibili.', noStats:'Statistiche non disponibili.',
    xgTitle:'Expected Goals (xG) stagionali', shotsTitle:'Tiri', possTitle:'Possesso',
    formTitle:'Forma recente', timingTitle:'Minuti gol', lastMeetings:'Ultimi incontri',
    serieAStats:'Statistiche Serie A', xgPerMatch:'xG/partita', xgaPerMatch:'xGA/partita',
    cleanSheets:'Clean sheet', matchesPlayed:'PG', goals:'Gol', assists:'Assist',
    apiOnline:'API connessa', apiOffline:'API non raggiungibile', valuebet:'VALUE',
    giornata:'Giornata', live:'LIVE', upcoming:'IN PROGRAMMA', finished:'TERMINATA',
    confidenza:'Confidenza', homeWins:'Vittorie casa', awayWins:'Vittorie ospite',
    draws:'Pareggi', avgGoals:'Media gol', bookmaker:'Bookmaker',
    probImplied:'Prob. implicita', noH2H:'Nessun precedente trovato.',
    analysisError:'Errore nel caricamento analisi.',
  },
  en: {
    loadingMatches:'Loading matches...', loadingStats:'Loading statistics...',
    loadingAnalysis:'Loading analysis...', noMatches:'No matches for this round.',
    errorApi:'Cannot connect to API.', retry:'Retry',
    analisi:'Analysis', h2h:'H2H', statistiche:'Statistics', quote:'Odds',
    risultatoProbabile:'Probable Result', sicura:'SAFE', media:'MEDIUM', rischiosa:'RISKY',
    homeWin:'Home Win', draw:'Draw', awayWin:'Away Win',
    over:'Over 2.5', under:'Under 2.5', bttsYes:'BTTS Yes', bttsNo:'BTTS No',
    noOdds:'Odds not available.', noStats:'Statistics not available.',
    xgTitle:'Season xG (Expected Goals)', shotsTitle:'Shots', possTitle:'Possession',
    formTitle:'Recent form', timingTitle:'Goal minutes', lastMeetings:'Last meetings',
    serieAStats:'Serie A Statistics', xgPerMatch:'xG/match', xgaPerMatch:'xGA/match',
    cleanSheets:'Clean sheets', matchesPlayed:'MP', goals:'Goals', assists:'Assists',
    apiOnline:'API connected', apiOffline:'API unreachable', valuebet:'VALUE',
    giornata:'Round', live:'LIVE', upcoming:'UPCOMING', finished:'FINISHED',
    confidenza:'Confidence', homeWins:'Home wins', awayWins:'Away wins',
    draws:'Draws', avgGoals:'Avg goals', bookmaker:'Bookmaker',
    probImplied:'Implied prob.', noH2H:'No head-to-head found.',
    analysisError:'Error loading analysis.',
  },
};
const T = () => T_DATA[state.lang];

/* ── DOM ────────────────────────────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */
function initNav() {
  $$('.nav-tab,.bottom-tab').forEach(btn =>
    btn.addEventListener('click', () => switchView(btn.dataset.view))
  );
}

function switchView(view) {
  state.currentView = view;
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-tab,.bottom-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  $(`#view-${view}`)?.classList.add('active');
  if (view === 'stats' && !state.teamStats.length) loadStats();
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANGUAGE
   ═══════════════════════════════════════════════════════════════════════════ */
function initLang() {
  $('#langToggle').addEventListener('click', () => {
    state.lang = state.lang === 'it' ? 'en' : 'it';
    $('#langToggle .lang-flag').textContent = state.lang === 'it' ? '🇮🇹' : '🇬🇧';
    $('#langLabel').textContent = state.lang.toUpperCase();
    applyTranslations();
  });
}

function applyTranslations() {
  $$('[data-it]').forEach(el => { el.textContent = el.dataset[state.lang] || el.dataset.it; });
}

/* ═══════════════════════════════════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════════════════════════════════ */
async function apiFetch(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
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

/* ═══════════════════════════════════════════════════════════════════════════
   GIORNATA
   ═══════════════════════════════════════════════════════════════════════════ */
function initGiornataSelector() {
  rebuildGiornataOptions();
  $('#giornataSelect').addEventListener('change', e => {
    state.currentGiornata = +e.target.value;
    renderMatchCards();
    updateGiornataArrows();
  });
  $('#giornataBack').addEventListener('click', () => {
    if (state.currentGiornata > 1) {
      state.currentGiornata--;
      $('#giornataSelect').value = state.currentGiornata;
      renderMatchCards();
      updateGiornataArrows();
    }
  });
  $('#giornataNext').addEventListener('click', () => {
    if (state.currentGiornata < state.maxGiornata) {
      state.currentGiornata++;
      $('#giornataSelect').value = state.currentGiornata;
      renderMatchCards();
      updateGiornataArrows();
    }
  });
  updateGiornataArrows();
}

function rebuildGiornataOptions() {
  const sel = $('#giornataSelect');
  const cur = state.currentGiornata;
  sel.innerHTML = Array.from({length: state.maxGiornata}, (_, i) => {
    const n = i + 1;
    return `<option value="${n}"${n === cur ? ' selected' : ''}>${n}ª ${T().giornata}</option>`;
  }).join('');
  updateGiornataArrows();
}

function updateGiornataArrows() {
  $('#giornataBack').disabled = state.currentGiornata <= 1;
  $('#giornataNext').disabled = state.currentGiornata >= state.maxGiornata;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIXTURES
   ═══════════════════════════════════════════════════════════════════════════ */
async function loadFixtures() {
  $('#matchesGrid').innerHTML = skeletonCards(6);
  try {
    state.fixtures = await apiFetch('/matches/');
    // Determine giornata from round field if present
    const rounds = [...new Set(state.fixtures.map(m => m.round).filter(Boolean))].sort((a,b)=>a-b);
    if (rounds.length) {
      state.maxGiornata = Math.max(38, ...rounds);
      const upcoming = state.fixtures.find(m => !m.home_score && m.status !== 'Finished');
      state.currentGiornata = upcoming?.round || rounds[rounds.length - 1];
    }
    rebuildGiornataOptions();
    renderMatchCards();
  } catch {
    $('#matchesGrid').innerHTML = errorState(T().errorApi, 'loadFixtures');
  }
}

function renderMatchCards() {
  const grid = $('#matchesGrid');
  let matches = state.fixtures.filter(m => m.round == null || m.round === state.currentGiornata);
  if (!matches.length && state.fixtures.length) matches = state.fixtures.slice(0, 10);
  if (!matches.length) {
    grid.innerHTML = `<div class="empty-state"><p>${T().noMatches}</p></div>`;
    return;
  }
  grid.innerHTML = matches.map(matchCardHTML).join('');
  grid.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('click', () => {
      const m = state.fixtures.find(f => f.id === card.dataset.id);
      if (m) openMatchOverlay(m);
    });
  });
}

function matchCardHTML(m) {
  const home = m.home_team, away = m.away_team;
  const time = m.start_timestamp ? formatTime(m.start_timestamp) : '--:--';
  const date = m.start_timestamp ? formatDate(m.start_timestamp) : '';
  const isLive = /progress|live|1st|2nd|ht/i.test(m.status);
  const isFin  = /finish|ended|ended/i.test(m.status);
  const badgeCls  = isLive ? 'badge-live' : isFin ? 'badge-finished' : 'badge-scheduled';
  const badgeTxt  = isLive ? T().live : isFin ? T().finished : T().upcoming;
  const hasScore  = m.home_score != null && m.away_score != null;
  const scoreHTML = hasScore
    ? `<div class="card-score">${m.home_score} – ${m.away_score}</div>`
    : `<div class="vs-text">VS</div>`;

  return `
    <div class="match-card" data-id="${m.id}">
      <span class="card-status-badge ${badgeCls}">${badgeTxt}</span>
      <div class="card-top">
        <div class="card-team home">
          ${logoHTML(home, 28)}
          <span class="team-name">${home.name}</span>
        </div>
        <div class="card-vs">${scoreHTML}</div>
        <div class="card-team away">
          ${logoHTML(away, 28)}
          <span class="team-name">${away.name}</span>
        </div>
      </div>
      <div class="card-bottom">
        <span class="card-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          ${date} ${time}
        </span>
        <div class="card-odds-preview" id="odds-p-${m.id}">
          <span class="odds-pill">—</span>
        </div>
      </div>
    </div>`;
}

function logoHTML(team, size) {
  const cls = size <= 28 ? 'team-logo' : 'team-logo-lg';
  if (team.logo_url) {
    return `<div class="${cls}"><img src="${team.logo_url}" alt="${team.name}" loading="lazy" onerror="this.parentElement.textContent='${teamEmoji(team.name)}'"></div>`;
  }
  return `<div class="${cls}">${teamEmoji(team.name)}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCH OVERLAY
   ═══════════════════════════════════════════════════════════════════════════ */
async function openMatchOverlay(match) {
  state.currentMatch = match;
  state.currentAnalysis = null;

  const overlay = $('#overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Hero — instant render
  $('#heroHomeName').textContent = match.home_team.name;
  $('#heroAwayName').textContent = match.away_team.name;
  $('#heroHomeLogo').innerHTML = logoHTML(match.home_team, 64).replace('team-logo', 'team-logo-lg');
  $('#heroAwayLogo').innerHTML = logoHTML(match.away_team, 64).replace('team-logo', 'team-logo-lg');
  $('#heroTime').textContent = match.start_timestamp ? formatTime(match.start_timestamp) : '--:--';
  $('#heroDate').textContent = match.start_timestamp ? formatDate(match.start_timestamp) : '';
  $('#overlayRound').textContent = match.round ? `${match.round}ª ${T().giornata}` : '';
  $('#heroHomeForm').innerHTML = '';
  $('#heroAwayForm').innerHTML = '';

  // Reset tabs
  $$('.analysis-tab').forEach(t => t.classList.remove('active'));
  $('#analysisTabs .analysis-tab[data-tab="analisi"]').classList.add('active');
  $$('.analysis-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.analysis-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderAnalysisTab(tab.dataset.tab);
    };
  });

  // Show spinner while fetching analysis
  $('#analysisContent').innerHTML = loadingSpinner(T().loadingAnalysis);

  try {
    state.currentAnalysis = await apiFetch(`/analyze/${match.id}`);
    // Render form badges with real data
    renderForm('#heroHomeForm', state.currentAnalysis.home_form);
    renderForm('#heroAwayForm', state.currentAnalysis.away_form);
  } catch (err) {
    $('#analysisContent').innerHTML = errorState(T().analysisError, `reopenOverlay`);
    return;
  }

  renderAnalysisTab('analisi');
}

function closeOverlay() {
  $('#overlay').classList.remove('open');
  $('#overlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.currentMatch = null;
  state.currentAnalysis = null;
}

$('#overlayBack')?.addEventListener('click', closeOverlay);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYSIS TABS  (all read from state.currentAnalysis — no extra fetches)
   ═══════════════════════════════════════════════════════════════════════════ */
function renderAnalysisTab(tab) {
  const a = state.currentAnalysis;
  if (!a) return;
  switch (tab) {
    case 'analisi':      $('#analysisContent').innerHTML = renderAnalisi(a); break;
    case 'h2h':         $('#analysisContent').innerHTML = renderH2H(a); break;
    case 'statistiche': $('#analysisContent').innerHTML = renderStatistiche(a); break;
    case 'quote':       $('#analysisContent').innerHTML = renderQuote(a); break;
  }
}

/* ── ANALISI ──────────────────────────────────────────────────────────── */
function renderAnalisi(a) {
  const pr = a.probable_result;
  const icons = {safe:'⚽', medium:'📊', risky:'🎯'};

  const recCards = a.recommendations.map(r => `
    <div class="rec-card ${r.type}">
      <div class="rec-icon">${icons[r.type] || '📌'}</div>
      <div class="rec-body">
        <div class="rec-label">${r.label}</div>
        <div class="rec-text">${r.text}${r.odds_value ? ` <span style="color:var(--accent)">@ ${r.odds_value}</span>` : ''}</div>
        <div class="rec-conf">${T().confidenza}: ${r.confidence}%</div>
      </div>
    </div>`).join('');

  return `
    <div class="recs-grid">${recCards}</div>
    <div class="probable-result">
      <div class="probable-result-label">${T().risultatoProbabile}</div>
      <div class="probable-score">${pr.home_goals} – ${pr.away_goals}</div>
      <div class="probable-probs">
        <div class="prob-item prob-home">
          <div class="prob-val">${pr.prob_home}%</div>
          <div class="prob-lbl">${T().homeWin}</div>
        </div>
        <div class="prob-item prob-draw">
          <div class="prob-val">${pr.prob_draw}%</div>
          <div class="prob-lbl">${T().draw}</div>
        </div>
        <div class="prob-item prob-away">
          <div class="prob-val">${pr.prob_away}%</div>
          <div class="prob-lbl">${T().awayWin}</div>
        </div>
      </div>
    </div>`;
}

/* ── H2H ──────────────────────────────────────────────────────────────── */
function renderH2H(a) {
  const s = a.h2h_summary;
  const home = state.currentMatch.home_team.name.split(' ')[0];
  const away = state.currentMatch.away_team.name.split(' ')[0];

  if (!a.h2h.length) {
    return `<div class="empty-state"><p>${T().noH2H}</p></div>`;
  }

  const rows = a.h2h.slice(0, 10).map(m => {
    const rCls = m.result === 'H' ? 'res-h' : m.result === 'D' ? 'res-d' : 'res-a';
    const rTxt = m.result === 'H' ? 'V' : m.result === 'D' ? 'P' : 'S';
    return `<tr>
      <td style="color:var(--text2);font-size:11px">${m.date}</td>
      <td style="font-size:13px;font-weight:600">${m.home_team}</td>
      <td style="text-align:center;font-weight:700">${m.home_score}–${m.away_score}</td>
      <td style="font-size:13px;font-weight:600;text-align:right">${m.away_team}</td>
      <td style="text-align:center"><span class="h2h-result ${rCls}">${rTxt}</span></td>
    </tr>`;
  }).join('');

  return `
    <div class="h2h-summary">
      <div class="h2h-sum-block">
        <div class="h2h-sum-val">${s.home_wins}</div>
        <div class="h2h-sum-lbl">${home}</div>
      </div>
      <div class="h2h-sum-block">
        <div class="h2h-sum-val">${s.draws}</div>
        <div class="h2h-sum-lbl">${T().draws}</div>
      </div>
      <div class="h2h-sum-block">
        <div class="h2h-sum-val">${s.away_wins}</div>
        <div class="h2h-sum-lbl">${away}</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:14px">
      <div class="stat-chip chip-xg" style="font-size:12px">⚽ ${T().avgGoals}: ${(s.home_goals_avg + s.away_goals_avg).toFixed(2)}/partita</div>
    </div>
    <div class="stats-section-title">${T().lastMeetings}</div>
    <table class="h2h-table">
      <thead><tr>
        <th>Data</th><th>Casa</th>
        <th style="text-align:center">Ris.</th>
        <th style="text-align:right">Ospite</th>
        <th style="text-align:center">Esito</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── STATISTICHE ──────────────────────────────────────────────────────── */
function renderStatistiche(a) {
  const match = state.currentMatch;
  const hName = match.home_team.name.split(' ')[0];
  const aName = match.away_team.name.split(' ')[0];
  const hxg = a.home_xg;
  const axg = a.away_xg;
  const hxga = a.home_xga;
  const axga = a.away_xga;

  const hasXg = hxg != null && axg != null;
  const maxXg = hasXg ? Math.max(hxg, axg, 0.5) : 2.0;

  const xgSection = hasXg ? `
    <div class="stats-section">
      <div class="stats-section-title">${T().xgTitle}</div>
      <div class="xg-chart">
        <div class="xg-row">
          <span class="xg-label">${hName}</span>
          <div class="xg-bar-wrap"><div class="xg-bar home" style="width:${(hxg/maxXg)*100}%"></div></div>
          <span class="xg-val home">${hxg}</span>
        </div>
        <div class="xg-row">
          <span class="xg-label">${aName}</span>
          <div class="xg-bar-wrap"><div class="xg-bar away" style="width:${(axg/maxXg)*100}%"></div></div>
          <span class="xg-val away">${axg}</span>
        </div>
      </div>
      ${hxga != null ? `
      <div style="margin-top:10px;font-size:11px;color:var(--text2)">
        xGA/partita — ${hName}: <span style="color:var(--green)">${hxga}</span> &nbsp; ${aName}: <span style="color:var(--orange)">${axga}</span>
      </div>` : ''}
    </div>` : `
    <div class="stats-section">
      <div class="empty-state" style="padding:24px 0">
        <p style="font-size:13px">Statistiche xG stagionali non disponibili.<br>I dati Understat vengono caricati separatamente.</p>
      </div>
    </div>`;

  // Derive some stats from H2H for the timing/shot section
  const h2hGoalsHome = a.h2h_summary.home_goals_avg;
  const h2hGoalsAway = a.h2h_summary.away_goals_avg;
  const hPoss = hasXg ? Math.round(50 + (hxg - axg) * 5) : 52;
  const aPoss = 100 - hPoss;

  return `
    ${xgSection}
    <div class="stats-section">
      <div class="stats-section-title">Media Gol H2H</div>
      <div class="stat-bars">
        <div class="stat-row">
          <span class="stat-home-val" style="color:var(--accent)">${h2hGoalsHome}</span>
          <span class="stat-label">Gol/partita (casa)</span>
          <span class="stat-away-val" style="color:var(--red)">${h2hGoalsAway}</span>
        </div>
        ${miniBar(hPoss, aPoss, T().possTitle, hName, aName)}
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">${T().formTitle}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--card);border-radius:var(--radius-sm)">
        <div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${hName}</div>
          <div style="display:flex;gap:4px">${formBadgesHTML(a.home_form)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${aName}</div>
          <div style="display:flex;gap:4px">${formBadgesHTML(a.away_form)}</div>
        </div>
      </div>
    </div>`;
}

/* ── QUOTE ────────────────────────────────────────────────────────────── */
function renderQuote(a) {
  const o = a.odds;
  if (!o.home_win && !o.draw && !o.away_win) {
    return `<div class="empty-state"><p>${T().noOdds}</p></div>`;
  }

  const implied = v => v ? `${(1/v*100).toFixed(0)}%` : '—';
  const isValue = v => v && (1/v) < 0.45;  // implied prob < 45% = potential value

  return `
    <div class="odds-section">
      <div class="odds-section-title">1X2${o.bookmaker ? ` — ${o.bookmaker}` : ''}</div>
      <div class="odds-grid">
        <div class="odds-block h1">
          <div class="odds-block-label">${T().homeWin}</div>
          <div class="odds-block-val">${o.home_win ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.home_win)} ${T().probImplied.toLowerCase()}</div>
          ${isValue(o.home_win) ? `<span class="value-tag">${T().valuebet}</span>` : ''}
        </div>
        <div class="odds-block dx">
          <div class="odds-block-label">${T().draw}</div>
          <div class="odds-block-val">${o.draw ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.draw)}</div>
        </div>
        <div class="odds-block h2">
          <div class="odds-block-label">${T().awayWin}</div>
          <div class="odds-block-val">${o.away_win ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.away_win)}</div>
          ${isValue(o.away_win) ? `<span class="value-tag">${T().valuebet}</span>` : ''}
        </div>
      </div>
    </div>

    ${o.over_2_5 || o.under_2_5 ? `
    <div class="odds-section">
      <div class="odds-section-title">Over / Under 2.5</div>
      <div class="odds-grid">
        <div class="odds-block ou-over">
          <div class="odds-block-label">${T().over}</div>
          <div class="odds-block-val">${o.over_2_5 ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.over_2_5)}</div>
        </div>
        <div class="odds-block ou-under">
          <div class="odds-block-label">${T().under}</div>
          <div class="odds-block-val">${o.under_2_5 ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.under_2_5)}</div>
        </div>
      </div>
    </div>` : ''}

    ${o.btts_yes || o.btts_no ? `
    <div class="odds-section">
      <div class="odds-section-title">Goal / No Goal</div>
      <div class="odds-grid">
        <div class="odds-block btts-y">
          <div class="odds-block-label">${T().bttsYes}</div>
          <div class="odds-block-val">${o.btts_yes ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.btts_yes)}</div>
        </div>
        <div class="odds-block btts-n">
          <div class="odds-block-label">${T().bttsNo}</div>
          <div class="odds-block-val">${o.btts_no ?? '—'}</div>
          <div class="odds-bookmaker">${implied(o.btts_no)}</div>
        </div>
      </div>
    </div>` : ''}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
async function loadStats() {
  const content = $('#statsContent');
  content.innerHTML = loadingSpinner(T().loadingStats);
  const season = $('#seasonSelect').value;
  try {
    [state.teamStats, state.playerStats] = await Promise.all([
      apiFetch(`/stats/teams?season=${season}`),
      apiFetch(`/stats/players?season=${season}`),
    ]);
  } catch {
    state.teamStats  = mockTeamStats();
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
      const initials = p.player_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
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

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString(state.lang === 'it' ? 'it-IT' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString(state.lang === 'it' ? 'it-IT' : 'en-GB',
    { day: '2-digit', month: 'short' });
}

function teamEmoji(name = '') {
  const map = {
    juventus:'⚫', inter:'🔵', milan:'🔴', napoli:'🔵', roma:'🟡', lazio:'🦅',
    atalanta:'⚫', fiorentina:'💜', bologna:'🔴', torino:'🟤', genoa:'🔵',
    cagliari:'🔴', monza:'⚪', lecce:'🟡', empoli:'🔵', udinese:'⚪',
    sassuolo:'🟢', salernitana:'🟤', hellas:'🔵', frosinone:'🟡',
    parma:'🟡', como:'🔵', venezia:'🟠',
  };
  const lc = name.toLowerCase();
  for (const [k, v] of Object.entries(map)) if (lc.includes(k)) return v;
  return name.slice(0, 2).toUpperCase();
}

function formBadgesHTML(form) {
  if (!form?.length) return '';
  return form.map(r => {
    const cls = r === 'W' ? 'form-w' : r === 'D' ? 'form-d' : 'form-l';
    const lbl = r === 'W' ? 'V' : r === 'D' ? 'P' : 'S';
    return `<span class="form-badge ${cls}">${lbl}</span>`;
  }).join('');
}

function renderForm(selector, form) {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = formBadgesHTML(form || []);
}

function miniBar(home, away, label, hName = '', aName = '') {
  const clampedHome = Math.max(0, Math.min(100, home));
  return `
    <div class="mini-bar-row">
      <div class="mini-bar-header">
        <span>${clampedHome}%${hName ? ` ${hName}` : ''}</span>
        <span>${label}</span>
        <span>${away}%${aName ? ` ${aName}` : ''}</span>
      </div>
      <div class="mini-bar-track">
        <div class="mini-bar-fill" style="width:${clampedHome}%"></div>
      </div>
    </div>`;
}

function loadingSpinner(text = '') {
  return `<div class="loading-state"><div class="spinner"></div><p>${text}</p></div>`;
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

function reopenOverlay() {
  if (state.currentMatch) openMatchOverlay(state.currentMatch);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK FALLBACKS  (only for Stats view when Understat is down)
   ═══════════════════════════════════════════════════════════════════════════ */
function mockTeamStats() {
  const teams = ['Inter','Juventus','Milan','Napoli','Atalanta','Roma','Lazio','Fiorentina',
    'Bologna','Torino','Genoa','Monza','Cagliari','Lecce','Empoli','Udinese','Parma','Como','Hellas Verona','Venezia'];
  return teams.map((name, i) => ({
    team_name: name, matches_played: 30, wins: 20 - i, draws: 5, losses: i + 5,
    goals_scored: +(2.1 - i * 0.07).toFixed(2), goals_conceded: +(0.8 + i * 0.07).toFixed(2),
    xg: +(2.0 - i * 0.06).toFixed(2), xga: +(0.9 + i * 0.06).toFixed(2),
    clean_sheets: 12 - i, failed_to_score: i,
  }));
}

function mockPlayerStats() {
  const players = [
    ['Lautaro Martinez','Inter'],['Dusan Vlahovic','Juventus'],['Romelu Lukaku','Napoli'],
    ['Paulo Dybala','Roma'],['Ademola Lookman','Atalanta'],['Khvicha Kvaratskhelia','Napoli'],
    ['Rafael Leao','Milan'],['Ciro Immobile','Lazio'],['Nicolo Barella','Inter'],
    ['Federico Chiesa','Juventus'],['Theo Hernandez','Milan'],['Marcus Thuram','Inter'],
    ['Lorenzo Pellegrini','Roma'],['Mario Pasalic','Atalanta'],['Artem Dovbyk','Roma'],
  ];
  return players.map(([name, team], i) => ({
    player_name: name, team_name: team, matches: 28, goals: Math.max(1, 18 - i),
    assists: Math.max(0, 10 - i), xg: +(16 - i * 0.8).toFixed(2),
    xa: +(9 - i * 0.4).toFixed(2), minutes: 28 * 82,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   PWA
   ═══════════════════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════ */
async function init() {
  initNav();
  initLang();
  initGiornataSelector();
  checkApiHealth();
  setInterval(checkApiHealth, 30000);
  await loadFixtures();
}

document.addEventListener('DOMContentLoaded', init);
