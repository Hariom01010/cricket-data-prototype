// Frontend communicates purely with backend proxy routes (/api/matches, /api/squad, /api/status)
// The CRICKETDATA_API_KEY is stored in server environment variable (.env) and NEVER sent to the client.

// The 8 Active Templates directly extracted from predictions-api-endpoints.yaml
const OPENAPI_TEMPLATES = [
  {
    code: "MATCH_WINNER",
    questionText: "Who will win {{teamA}} vs {{teamB}}?",
    answerType: "TEAM_SELECT",
    optionSource: "MATCH_TEAMS",
    evaluator: "MATCH_WINNER",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  },
  {
    code: "TOSS_WINNER",
    questionText: "Who will win the toss in {{teamA}} vs {{teamB}}?",
    answerType: "TEAM_SELECT",
    optionSource: "MATCH_TEAMS",
    evaluator: "TOSS_WINNER",
    lockPolicy: "BEFORE_TOSS",
    points: 10,
    selected: true
  },
  {
    code: "TOSS_DECISION",
    questionText: "Will the toss winner bat or bowl?",
    answerType: "ENUM_SELECT",
    optionSource: "BAT_OR_BOWL",
    evaluator: "TOSS_DECISION",
    lockPolicy: "BEFORE_TOSS",
    points: 10,
    selected: true
  },
  {
    code: "MOST_RUNS",
    questionText: "Who will score the most runs?",
    answerType: "PLAYER_SELECT",
    optionSource: "CONFIRMED_MATCH_PLAYERS",
    evaluator: "MOST_RUNS",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  },
  {
    code: "MOST_WICKETS",
    questionText: "Who will take the most wickets?",
    answerType: "PLAYER_SELECT",
    optionSource: "CONFIRMED_MATCH_PLAYERS",
    evaluator: "MOST_WICKETS",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  },
  {
    code: "MOST_SIXES_TEAM",
    questionText: "Which team will hit more sixes?",
    answerType: "TEAM_SELECT",
    optionSource: "MATCH_TEAMS_WITH_TIE",
    evaluator: "MOST_SIXES_TEAM",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  },
  {
    code: "PLAYER_OF_MATCH",
    questionText: "Who will be Player of the Match?",
    answerType: "PLAYER_SELECT",
    optionSource: "CONFIRMED_MATCH_PLAYERS",
    evaluator: "PLAYER_OF_MATCH",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  },
  {
    code: "FINAL_SCHEDULED_OVER",
    questionText: "Will the match reach the final scheduled over?",
    answerType: "YES_NO",
    optionSource: "YES_NO",
    evaluator: "FINAL_SCHEDULED_OVER",
    lockPolicy: "BEFORE_MATCH_START",
    points: 10,
    selected: true
  }
];

// App State
let liveMatches = [];
let selectedMatch = null;
let currentSquadData = null;
let generatedOpenApiQuestions = [];

// DOM Elements
const envKeyStatus = document.getElementById('envKeyStatus');
const hitCountEl = document.getElementById('hitCount');
const fetchMatchesBtn = document.getElementById('fetchMatchesBtn');
const fetchSquadBtn = document.getElementById('fetchSquadBtn');
const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
const matchListView = document.getElementById('matchListView');
const rawApiView = document.getElementById('rawApiView');
const rawJsonCode = document.getElementById('rawJsonCode');
const tabMatchList = document.getElementById('tabMatchList');
const tabRawApi = document.getElementById('tabRawApi');
const tabQuestionsCards = document.getElementById('tabQuestionsCards');
const tabOpenApiJson = document.getElementById('tabOpenApiJson');
const questionsCardsView = document.getElementById('questionsCardsView');
const openApiJsonView = document.getElementById('openApiJsonView');
const openApiOutputCode = document.getElementById('openApiOutputCode');
const selectedMatchName = document.getElementById('selectedMatchName');
const matchUtcTime = document.getElementById('matchUtcTime');
const matchTossLock = document.getElementById('matchTossLock');
const matchStartLock = document.getElementById('matchStartLock');
const templatesSelectorGrid = document.getElementById('templatesSelectorGrid');

async function init() {
  renderTemplateSelectors();
  setupEventListeners();
  await checkServerStatus();
}

async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Proxy offline');
    const data = await res.json();
    
    hitCountEl.innerText = data.hitsToday || 0;
    
    if (data.hasApiKey) {
      envKeyStatus.innerText = '✓ .env Key Active';
      envKeyStatus.className = 'env-status-badge configured';
    } else {
      envKeyStatus.innerText = '⚠ .env Key Missing';
      envKeyStatus.className = 'env-status-badge missing';
    }
  } catch (e) {
    envKeyStatus.innerText = 'Proxy Offline';
    envKeyStatus.className = 'env-status-badge error';
  }
}

function setupEventListeners() {
  fetchMatchesBtn.addEventListener('click', fetchMatchesFromProxy);
  fetchSquadBtn.addEventListener('click', fetchMatchSquadFromProxy);
  generateQuestionsBtn.addEventListener('click', generateOpenApiQuestions);

  // View Tabs
  tabMatchList.addEventListener('click', () => {
    tabMatchList.classList.add('active');
    tabRawApi.classList.remove('active');
    matchListView.classList.remove('hidden');
    rawApiView.classList.add('hidden');
  });

  tabRawApi.addEventListener('click', () => {
    tabRawApi.classList.add('active');
    tabMatchList.classList.remove('active');
    rawApiView.classList.remove('hidden');
    matchListView.classList.add('hidden');
  });

  tabQuestionsCards.addEventListener('click', () => {
    tabQuestionsCards.classList.add('active');
    tabOpenApiJson.classList.remove('active');
    questionsCardsView.classList.remove('hidden');
    openApiJsonView.classList.add('hidden');
  });

  tabOpenApiJson.addEventListener('click', () => {
    tabOpenApiJson.classList.add('active');
    tabQuestionsCards.classList.remove('active');
    openApiJsonView.classList.remove('hidden');
    questionsCardsView.classList.add('hidden');
  });
}

function renderTemplateSelectors() {
  templatesSelectorGrid.innerHTML = '';
  OPENAPI_TEMPLATES.forEach(t => {
    const chip = document.createElement('label');
    chip.className = `spec-chip ${t.selected ? 'checked' : ''}`;
    chip.innerHTML = `
      <input type="checkbox" ${t.selected ? 'checked' : ''} data-code="${t.code}" />
      <span>${t.code}</span>
    `;
    chip.querySelector('input').addEventListener('change', (e) => {
      t.selected = e.target.checked;
      chip.classList.toggle('checked', t.selected);
    });
    templatesSelectorGrid.appendChild(chip);
  });
}

// 1. Fetch Matches from Secure Backend Proxy
async function fetchMatchesFromProxy() {
  fetchMatchesBtn.innerText = "Loading...";
  fetchMatchesBtn.disabled = true;

  try {
    const res = await fetch('/api/matches');
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText}): ${text.substring(0, 150)}`);
    }
    
    rawJsonCode.innerText = JSON.stringify(json, null, 2);

    if (json.status !== "success" || !json.data) {
      throw new Error(json.message || json.reason || "Failed to fetch matches from CricketData");
    }

    liveMatches = json.data;
    renderMatchesList();

    if (liveMatches.length > 0) {
      selectMatch(liveMatches[0]);
    }
    await checkServerStatus();
  } catch (err) {
    console.error("Fetch error:", err);
    alert(`Error: ${err.message}`);
    rawJsonCode.innerText = `Error: ${err.message}`;
  } finally {
    fetchMatchesBtn.innerText = "Fetch Matches";
    fetchMatchesBtn.disabled = false;
  }
}

// 2. Compute Cutoffs (LocksAt) based on Q1 Requirement & OpenAPI LockPolicy
function computeLocksAt(dateTimeGMT, lockPolicy) {
  if (!dateTimeGMT) return new Date().toISOString();
  const matchStartTime = new Date(dateTimeGMT.endsWith('Z') ? dateTimeGMT : dateTimeGMT + 'Z');
  
  if (lockPolicy === "BEFORE_TOSS") {
    return new Date(matchStartTime.getTime() - (30 * 60 * 1000)).toISOString();
  } else {
    return new Date(matchStartTime.getTime() - (5 * 60 * 1000)).toISOString();
  }
}

function parseMatchTeams(match) {
  let teamA = "Team A";
  let teamB = "Team B";

  if (Array.isArray(match.teams) && match.teams.length >= 2) {
    teamA = match.teams[0];
    teamB = match.teams[1];
  } else if (match.name && match.name.includes(" vs ")) {
    const parts = match.name.split(',')[0].split(' vs ');
    teamA = parts[0].trim();
    teamB = parts[1].trim();
  }

  const teamAId = (match.teamInfo && match.teamInfo[0]?.shortname) 
    ? `team_${match.teamInfo[0].shortname.toLowerCase()}` 
    : `team_${teamA.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const teamBId = (match.teamInfo && match.teamInfo[1]?.shortname) 
    ? `team_${match.teamInfo[1].shortname.toLowerCase()}` 
    : `team_${teamB.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  return { teamA, teamB, teamAId, teamBId };
}

function renderMatchesList() {
  matchListView.innerHTML = '';
  if (!liveMatches.length) {
    matchListView.innerHTML = `<div class="empty-state">No matches found.</div>`;
    return;
  }

  liveMatches.forEach(m => {
    const card = document.createElement('div');
    card.className = `match-card ${selectedMatch?.id === m.id ? 'selected' : ''}`;
    
    const matchUtc = new Date(m.dateTimeGMT ? (m.dateTimeGMT.endsWith('Z') ? m.dateTimeGMT : m.dateTimeGMT + 'Z') : Date.now());
    const now = new Date();
    const diffMs = matchUtc.getTime() - now.getTime();
    const isLiveOrDone = diffMs <= 0;

    let countdown = '';
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      countdown = hours > 24 ? `In ${Math.round(hours / 24)}d` : `In ${hours}h ${mins}m`;
    } else {
      countdown = m.status || 'Live / Completed';
    }

    card.innerHTML = `
      <div class="match-header-row">
        <span class="match-type-pill">${m.matchType || 'Match'}</span>
        <span class="countdown-pill ${isLiveOrDone ? 'live-now' : ''}">${countdown}</span>
      </div>
      <div class="match-title">${m.name}</div>
      <div class="match-venue">📍 ${m.venue || 'Venue TBD'}</div>
      <div class="timing-row">
        <span>UTC: <code>${m.dateTimeGMT || 'N/A'}</code></span>
        <span class="time-val">${matchUtc.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</span>
      </div>
    `;

    card.addEventListener('click', () => selectMatch(m));
    matchListView.appendChild(card);
  });
}

function selectMatch(m) {
  selectedMatch = m;
  currentSquadData = null;
  renderMatchesList();

  selectedMatchName.innerText = m.name;
  matchUtcTime.innerText = `dateTimeGMT: ${m.dateTimeGMT || 'N/A'}`;
  
  const tossCutoff = computeLocksAt(m.dateTimeGMT, "BEFORE_TOSS");
  const matchCutoff = computeLocksAt(m.dateTimeGMT, "BEFORE_MATCH_START");

  matchTossLock.innerText = `Toss Cutoff (T-30m): ${tossCutoff.substring(11, 16)} UTC`;
  matchStartLock.innerText = `Match Cutoff (T-5m): ${matchCutoff.substring(11, 16)} UTC`;

  fetchSquadBtn.removeAttribute('disabled');
  generateQuestionsBtn.removeAttribute('disabled');

  generateOpenApiQuestions();
}

// Fetch match squad from backend proxy
async function fetchMatchSquadFromProxy() {
  if (!selectedMatch) return;

  fetchSquadBtn.innerText = "Loading...";
  fetchSquadBtn.disabled = true;

  try {
    const res = await fetch(`/api/squad?id=${encodeURIComponent(selectedMatch.id)}`);
    const json = await res.json();

    if (json.status !== "success" || !json.data) {
      throw new Error(json.message || json.reason || "Failed to fetch squad");
    }

    currentSquadData = json.data;
    generateOpenApiQuestions();
    alert(`Loaded confirmed squad (${currentSquadData.length} teams).`);
    await checkServerStatus();
  } catch (err) {
    console.error("Squad fetch error:", err);
    alert(`Could not fetch squad: ${err.message}. Using fallback options.`);
  } finally {
    fetchSquadBtn.innerText = "Fetch Match Squad (1 Hit)";
    fetchSquadBtn.disabled = false;
  }
}

// 3. Resolve Options strictly according to OpenAPI OptionSource schema
function resolveOptions(optionSource, match, squadData) {
  const { teamA, teamB, teamAId, teamBId } = parseMatchTeams(match);

  switch (optionSource) {
    case "MATCH_TEAMS":
      return [
        { id: teamAId, label: teamA },
        { id: teamBId, label: teamB }
      ];

    case "MATCH_TEAMS_WITH_TIE":
      return [
        { id: teamAId, label: teamA },
        { id: teamBId, label: teamB },
        { id: "tie_equal", label: "Tie / Equal" }
      ];

    case "BAT_OR_BOWL":
      return [
        { id: "choice_bat", label: "Bat" },
        { id: "choice_bowl", label: "Bowl" }
      ];

    case "YES_NO":
      return [
        { id: "choice_yes", label: "Yes" },
        { id: "choice_no", label: "No" }
      ];

    case "CONFIRMED_MATCH_PLAYERS":
      if (squadData && Array.isArray(squadData) && squadData.length > 0) {
        const players = [];
        squadData.forEach(teamSquad => {
          if (Array.isArray(teamSquad.players)) {
            teamSquad.players.forEach(p => {
              players.push({
                id: `player_${p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                label: p.name
              });
            });
          }
        });
        if (players.length > 0) {
          return players.slice(0, 8);
        }
      }
      return [
        { id: "player_top_order_1", label: `Top Order Batsman (${teamA})` },
        { id: "player_top_order_2", label: `Top Order Batsman (${teamB})` },
        { id: "player_lead_pacer", label: "Leading Strike Bowler" },
        { id: "player_allrounder", label: "Key Allrounder" }
      ];

    default:
      return [
        { id: "opt_1", label: "Option 1" },
        { id: "opt_2", label: "Option 2" }
      ];
  }
}

// 4. Generate CreatedQuestionList (OpenAPI /admin/matches/{matchId}/prediction-questions 201 Response)
function generateOpenApiQuestions() {
  if (!selectedMatch) return;

  const { teamA, teamB } = parseMatchTeams(selectedMatch);
  const selectedTemplates = OPENAPI_TEMPLATES.filter(t => t.selected);
  const nowUtc = new Date().toISOString();

  generatedOpenApiQuestions = selectedTemplates.map((t) => {
    const resolvedQuestionText = t.questionText
      .replace(/\{\{teamA\}\}/g, teamA)
      .replace(/\{\{teamB\}\}/g, teamB);

    const options = resolveOptions(t.optionSource, selectedMatch, currentSquadData);
    const locksAt = computeLocksAt(selectedMatch.dateTimeGMT, t.lockPolicy);

    return {
      id: `question_${selectedMatch.id.substring(0, 8)}_${t.code.toLowerCase()}`,
      matchId: selectedMatch.id,
      templateCode: t.code,
      templateVersion: 1,
      questionType: "STATIC",
      questionText: resolvedQuestionText,
      answerType: t.answerType,
      optionSource: t.optionSource,
      options: options,
      evaluator: t.evaluator,
      lockPolicy: t.lockPolicy,
      locksAt: locksAt,
      points: t.points,
      status: "DRAFT",
      result: null,
      voidReason: null,
      createdAt: nowUtc,
      updatedAt: nowUtc
    };
  });

  renderGeneratedQuestionsCards();
  renderOpenApiJson();
}

function renderGeneratedQuestionsCards() {
  questionsCardsView.innerHTML = '';
  if (!generatedOpenApiQuestions.length) {
    questionsCardsView.innerHTML = `<div class="empty-state">No questions generated.</div>`;
    return;
  }

  generatedOpenApiQuestions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="question-top">
        <span class="q-badge-code">${q.templateCode} · ${q.answerType}</span>
        <span class="q-lock-time">Locks: ${q.locksAt.substring(11, 16)} UTC (${q.lockPolicy})</span>
      </div>
      <div class="q-text">${q.questionText}</div>
      <div class="q-options">
        ${q.options.map(opt => `
          <div class="q-option-btn">
            <span>${opt.label}</span>
            <span class="opt-id">${opt.id}</span>
          </div>
        `).join('')}
      </div>
      <div class="q-meta">
        <span>Source: <code>${q.optionSource}</code></span>
        <span>Evaluator: <code>${q.evaluator}</code> · Points: <strong>${q.points}</strong></span>
      </div>
    `;
    questionsCardsView.appendChild(card);
  });
}

function renderOpenApiJson() {
  const openApiResponsePayload = {
    items: generatedOpenApiQuestions
  };
  openApiOutputCode.innerText = JSON.stringify(openApiResponsePayload, null, 2);
}

window.addEventListener('DOMContentLoaded', init);
