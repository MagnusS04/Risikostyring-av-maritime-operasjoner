// Flashcards-modul: snu-kort, tema-filter, vanskelig-bunke,
// "spaced repetition lite" (vekt-basert sampling).
import * as storage from './storage.js';

const PROGRESS_KEY = 'flashcards.progress';
const FILTER_KEY = 'flashcards.tema';

const moduleState = {
  data: null,
  pool: [],         // filtrert liste
  currentId: null,
  flipped: false,
  tema: 'alle',
  progress: {},     // { fc-001: { weight, correct, wrong, lastSeen } }
  sessionSeen: new Set(),
  keyHandler: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function getEntry(id) {
  return moduleState.progress[id] || { weight: 1, correct: 0, wrong: 0, lastSeen: 0 };
}
function getWeight(id) {
  return Math.max(getEntry(id).weight ?? 1, 0.05);
}

function rebuildPool() {
  const all = (moduleState.data && moduleState.data.flashcards) || [];
  moduleState.pool = moduleState.tema === 'alle'
    ? all.slice()
    : all.filter((c) => c.tema === moduleState.tema);
}

function pickNext() {
  const pool = moduleState.pool;
  if (!pool.length) return null;

  const weights = pool.map((c) => {
    let w = getWeight(c.id);
    if (c.id === moduleState.currentId) w *= 0.05; // unngå samme kort to ganger på rad
    return Math.max(w, 0.01);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)].id;

  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

function markCard(id, knewIt) {
  const cur = { ...getEntry(id) };
  if (knewIt) {
    cur.correct = (cur.correct || 0) + 1;
    cur.weight = Math.max((cur.weight ?? 1) * 0.5, 0.25);
  } else {
    cur.wrong = (cur.wrong || 0) + 1;
    cur.weight = Math.min((cur.weight ?? 1) * 2, 8);
  }
  cur.lastSeen = Date.now();
  moduleState.progress[id] = cur;
  storage.set(PROGRESS_KEY, moduleState.progress);
  moduleState.sessionSeen.add(id);
}

function getCurrentCard() {
  return moduleState.pool.find((c) => c.id === moduleState.currentId) || null;
}

function findTema(id) {
  const t = (moduleState.data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

function flip() {
  moduleState.flipped = !moduleState.flipped;
  draw();
}

function next(knewIt) {
  const card = getCurrentCard();
  if (card) markCard(card.id, knewIt);
  moduleState.currentId = pickNext();
  moduleState.flipped = false;
  draw();
}

function setTema(value) {
  moduleState.tema = value;
  storage.set(FILTER_KEY, value);
  rebuildPool();
  if (!moduleState.pool.find((c) => c.id === moduleState.currentId)) {
    moduleState.currentId = pickNext();
  }
  moduleState.flipped = false;
  draw();
}

// --- Statistikk for header ---
function poolStats() {
  const pool = moduleState.pool;
  let kunne = 0, ovemer = 0, urort = 0;
  for (const c of pool) {
    const e = moduleState.progress[c.id];
    if (!e) urort++;
    else if ((e.weight ?? 1) <= 0.5) kunne++;
    else if ((e.weight ?? 1) > 1) ovemer++;
  }
  return { total: pool.length, kunne, ovemer, urort };
}

// --- DOM ---
let rootEl = null;

function draw() {
  if (!rootEl) return;
  const stats = poolStats();
  const card = getCurrentCard();

  const temaer = moduleState.data?.temaer || [];
  const temaOptions = ['<option value="alle">Alle temaer</option>']
    .concat(temaer.map((t) =>
      `<option value="${escapeHtml(t.id)}"${moduleState.tema === t.id ? ' selected' : ''}>${escapeHtml(t.navn)}</option>`
    ))
    .join('');

  const sessionSize = moduleState.sessionSeen.size;
  const progressPct = stats.total === 0 ? 0 : Math.min(100, Math.round((sessionSize / stats.total) * 100));

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Flashcards</h1>
          <p class="text-sm opacity-70">Snu kortet, marker om du kunne det. Vanskelige kort vises oftere.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>Sett i sesjonen: <span class="font-semibold">${sessionSize}</span></div>
          <div>I bunken: <span class="font-semibold">${stats.total}</span></div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="fc-tema" class="text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${temaOptions}
          </select>
        </label>
        <div class="flex items-center gap-2 text-xs">
          <span class="diff-pill diff-lett">${stats.kunne} kunne</span>
          <span class="diff-pill diff-middels">${stats.ovemer} må øve</span>
          <span class="diff-pill" style="background:#e2e8f0;color:#334155">${stats.urort} urørt</span>
        </div>
      </div>

      <div class="progressbar mb-4" aria-label="Sesjonsfremdrift">
        <div style="width:${progressPct}%"></div>
      </div>

      ${card ? renderCard(card) : renderEmpty()}

      <p class="mt-4 text-xs opacity-60">
        Tastatur: <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">Mellomrom</kbd> snur kortet,
        <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">→</kbd> kunne den,
        <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">←</kbd> må øve mer.
      </p>
    </section>
  `;

  // Bind events
  document.getElementById('fc-tema')?.addEventListener('change', (e) => setTema(e.target.value));

  const cardEl = document.getElementById('fc-card');
  if (cardEl) {
    cardEl.addEventListener('click', flip);
  }

  document.getElementById('fc-knew')?.addEventListener('click', () => next(true));
  document.getElementById('fc-again')?.addEventListener('click', () => next(false));
  document.getElementById('fc-flip')?.addEventListener('click', flip);
}

function renderCard(card) {
  const tema = findTema(card.tema);
  const front = escapeHtml(card.front || '');
  const back = escapeHtml(card.back || '');
  const kilde = card.kilde ? escapeHtml(card.kilde) : '';
  const vanske = card.vanskegrad || 'middels';

  const e = getEntry(card.id);
  const seenInfo = (e.correct || e.wrong)
    ? `Sett før: ${e.correct} ✓ / ${e.wrong} ✗`
    : 'Nytt kort';

  return `
    <div id="fc-card"
         class="flashcard ${moduleState.flipped ? 'flipped' : ''}"
         tabindex="0"
         role="button"
         aria-pressed="${moduleState.flipped}"
         aria-label="Flashcard, klikk for å snu">
      <span class="flashcard-label">${moduleState.flipped ? 'Svar' : 'Spørsmål'} · ${escapeHtml(tema)}</span>
      <div class="flashcard-content">
        ${moduleState.flipped ? back : front}
      </div>
      <span class="flashcard-meta">
        <span class="diff-pill diff-${escapeHtml(vanske)}">${escapeHtml(vanske)}</span>
        ${kilde ? ` · ${kilde}` : ''}
      </span>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      ${moduleState.flipped ? `
        <button id="fc-again" type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium">
          ← Må øve mer
        </button>
        <button id="fc-knew" type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          Kunne den →
        </button>
      ` : `
        <button id="fc-flip" type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
          Snu kortet
        </button>
      `}
    </div>

    <p class="mt-2 text-xs opacity-60">${seenInfo}</p>
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen flashcards i dette temaet</p>
      <p class="text-sm opacity-80">Velg "Alle temaer" eller et annet tema for å øve.</p>
    </div>
  `;
}

// --- Tastatur ---
function onKey(e) {
  // Bare aktiv når flashcards-ruten er aktiv
  if (!location.hash.startsWith('#/flashcards')) return;

  // Ikke kapre når brukeren skriver i et felt
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    flip();
  } else if (e.key === 'ArrowRight' && moduleState.flipped) {
    e.preventDefault();
    next(true);
  } else if (e.key === 'ArrowLeft' && moduleState.flipped) {
    e.preventDefault();
    next(false);
  }
}

// --- Eksport ---
export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;
  moduleState.progress = storage.get(PROGRESS_KEY, {}) || {};
  moduleState.tema = storage.get(FILTER_KEY, 'alle') || 'alle';

  rebuildPool();

  const stillValid = moduleState.currentId &&
    moduleState.pool.find((c) => c.id === moduleState.currentId);
  if (!stillValid) {
    moduleState.currentId = pickNext();
    moduleState.flipped = false;
  }

  // (Re-)bind globalt tastatur for denne ruten
  if (moduleState.keyHandler) {
    document.removeEventListener('keydown', moduleState.keyHandler);
  }
  moduleState.keyHandler = onKey;
  document.addEventListener('keydown', moduleState.keyHandler);

  draw();
}
