// Multiple choice-modul: alternativ-spørsmål, umiddelbar tilbakemelding,
// forklaring, tema- og vanskegrad-filter, "bare nye"-modus.
import * as storage from './storage.js';

const PROGRESS_KEY = 'multiplechoice.progress';
const TEMA_KEY = 'multiplechoice.tema';
const VANSKE_KEY = 'multiplechoice.vanske';
const BARENYE_KEY = 'multiplechoice.barenye';

const moduleState = {
  data: null,
  pool: [],
  queue: [],
  currentId: null,
  selected: null,    // valgt indeks (eller null)
  revealed: false,
  tema: 'alle',
  vanske: 'alle',
  bareNye: false,
  progress: {},      // { mc-001: { correct, wrong, lastCorrect, lastSeen } }
  sessionAnswered: 0,
  sessionCorrect: 0,
  keyHandler: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function findTema(id) {
  const t = (moduleState.data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

function getEntry(id) {
  return moduleState.progress[id] || { correct: 0, wrong: 0, lastCorrect: null, lastSeen: 0 };
}

function rebuildPool() {
  const all = (moduleState.data && moduleState.data.multiplechoice) || [];
  moduleState.pool = all.filter((q) => {
    if (moduleState.tema !== 'alle' && q.tema !== moduleState.tema) return false;
    if (moduleState.vanske !== 'alle' && q.vanskegrad !== moduleState.vanske) return false;
    if (moduleState.bareNye) {
      const e = moduleState.progress[q.id];
      if (e && e.lastCorrect === true) return false;
    }
    return true;
  });
  moduleState.queue = shuffle(moduleState.pool).map((q) => q.id);
}

function pickNext() {
  if (!moduleState.queue.length) {
    moduleState.queue = shuffle(moduleState.pool).map((q) => q.id);
  }
  while (moduleState.queue.length) {
    const id = moduleState.queue.shift();
    if (moduleState.pool.find((q) => q.id === id)) return id;
  }
  return null;
}

function getCurrentQ() {
  return moduleState.pool.find((q) => q.id === moduleState.currentId) || null;
}

function answer(idx) {
  if (moduleState.revealed) return;
  const q = getCurrentQ();
  if (!q) return;

  moduleState.selected = idx;
  moduleState.revealed = true;

  const correct = idx === q.rett;
  const cur = { ...getEntry(q.id) };
  if (correct) cur.correct = (cur.correct || 0) + 1;
  else cur.wrong = (cur.wrong || 0) + 1;
  cur.lastCorrect = correct;
  cur.lastSeen = Date.now();
  moduleState.progress[q.id] = cur;
  storage.set(PROGRESS_KEY, moduleState.progress);

  moduleState.sessionAnswered++;
  if (correct) moduleState.sessionCorrect++;
  draw();
}

function nextQuestion() {
  moduleState.currentId = pickNext();
  moduleState.selected = null;
  moduleState.revealed = false;
  draw();
}

function setTema(v) {
  moduleState.tema = v;
  storage.set(TEMA_KEY, v);
  resetForFilters();
}
function setVanske(v) {
  moduleState.vanske = v;
  storage.set(VANSKE_KEY, v);
  resetForFilters();
}
function setBareNye(v) {
  moduleState.bareNye = !!v;
  storage.set(BARENYE_KEY, moduleState.bareNye);
  resetForFilters();
}

function resetForFilters() {
  rebuildPool();
  moduleState.currentId = pickNext();
  moduleState.selected = null;
  moduleState.revealed = false;
  draw();
}

// --- DOM ---
let rootEl = null;

function poolStats() {
  let riktig = 0, feil = 0, urort = 0;
  for (const q of moduleState.pool) {
    const e = moduleState.progress[q.id];
    if (!e) urort++;
    else if (e.lastCorrect) riktig++;
    else feil++;
  }
  return { total: moduleState.pool.length, riktig, feil, urort };
}

function draw() {
  if (!rootEl) return;
  const stats = poolStats();
  const q = getCurrentQ();
  const temaer = moduleState.data?.temaer || [];

  const temaOptions = ['<option value="alle">Alle temaer</option>']
    .concat(temaer.map((t) =>
      `<option value="${escapeHtml(t.id)}"${moduleState.tema === t.id ? ' selected' : ''}>${escapeHtml(t.navn)}</option>`
    ))
    .join('');

  const vanskeOptions = [
    ['alle', 'Alle nivåer'],
    ['lett', 'Lett'],
    ['middels', 'Middels'],
    ['vanskelig', 'Vanskelig'],
  ].map(([v, l]) =>
    `<option value="${v}"${moduleState.vanske === v ? ' selected' : ''}>${l}</option>`
  ).join('');

  const sessionRatio = moduleState.sessionAnswered > 0
    ? Math.round((moduleState.sessionCorrect / moduleState.sessionAnswered) * 100)
    : 0;

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Multiple choice</h1>
          <p class="text-sm opacity-70">Svar – få umiddelbar tilbakemelding og forklaring.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>Sesjon: <span class="font-semibold">${moduleState.sessionCorrect}/${moduleState.sessionAnswered}</span> (${sessionRatio}%)</div>
          <div>I bunken: <span class="font-semibold">${stats.total}</span></div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="mc-tema" class="w-full text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${temaOptions}
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Vanskegrad</span>
          <select id="mc-vanske" class="w-full text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${vanskeOptions}
          </select>
        </label>
        <label class="text-sm flex items-end gap-2">
          <input id="mc-barenye" type="checkbox" ${moduleState.bareNye ? 'checked' : ''}
                 class="w-4 h-4 mb-2 accent-primary">
          <span class="mb-2">Bare nye / ikke riktige sist</span>
        </label>
      </div>

      <div class="flex items-center gap-2 text-xs mb-4">
        <span class="diff-pill diff-lett">${stats.riktig} riktig sist</span>
        <span class="diff-pill diff-vanskelig">${stats.feil} feil sist</span>
        <span class="diff-pill" style="background:#e2e8f0;color:#334155">${stats.urort} urørt</span>
      </div>

      ${q ? renderQuestion(q) : renderEmpty()}

      <p class="mt-4 text-xs opacity-60">
        Tastatur: <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">1</kbd>–<kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">4</kbd> velger alternativ,
        <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> går til neste.
      </p>
    </section>
  `;

  // Bind events
  document.getElementById('mc-tema')?.addEventListener('change', (e) => setTema(e.target.value));
  document.getElementById('mc-vanske')?.addEventListener('change', (e) => setVanske(e.target.value));
  document.getElementById('mc-barenye')?.addEventListener('change', (e) => setBareNye(e.target.checked));

  document.querySelectorAll('[data-mc-alt]').forEach((el) => {
    el.addEventListener('click', () => answer(parseInt(el.dataset.mcAlt, 10)));
  });
  document.getElementById('mc-next')?.addEventListener('click', nextQuestion);
}

function renderQuestion(q) {
  const tema = findTema(q.tema);
  const vanske = q.vanskegrad || 'middels';
  const e = getEntry(q.id);
  const seenInfo = (e.correct || e.wrong)
    ? `Sett før: ${e.correct} ✓ / ${e.wrong} ✗`
    : 'Nytt spørsmål';

  const altsHtml = (q.alternativer || []).map((alt, idx) => {
    const isCorrect = idx === q.rett;
    const isSelected = idx === moduleState.selected;
    let cls = 'mc-alt';
    let mark = '';
    if (moduleState.revealed) {
      if (isCorrect) cls += ' is-correct';
      else if (isSelected) cls += ' is-wrong';
      else cls += ' is-other';
      if (isCorrect) mark = '<span class="mc-mark text-emerald-700 dark:text-emerald-300">✓</span>';
      else if (isSelected) mark = '<span class="mc-mark text-red-700 dark:text-red-300">✗</span>';
    }
    return `
      <button type="button"
              data-mc-alt="${idx}"
              ${moduleState.revealed ? 'disabled' : ''}
              class="${cls}">
        <span class="mc-letter">${String.fromCharCode(65 + idx)}</span>
        <span class="mc-text">${escapeHtml(alt)}</span>
        ${mark}
      </button>
    `;
  }).join('');

  let feedback = '';
  if (moduleState.revealed) {
    const correct = moduleState.selected === q.rett;
    feedback = `
      <div class="mt-4 p-4 rounded-lg ${correct
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
        : 'bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100'}">
        <p class="font-semibold mb-1">${correct ? 'Riktig!' : 'Feil.'}</p>
        ${q.forklaring ? `<p class="text-sm">${escapeHtml(q.forklaring)}</p>` : ''}
        ${q.kilde ? `<p class="text-xs opacity-70 mt-2">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}
      </div>
      <button id="mc-next" type="button"
              class="mt-3 w-full px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
        Neste spørsmål →
      </button>
    `;
  }

  return `
    <div class="mb-2 flex items-center gap-2 flex-wrap text-xs opacity-70">
      <span>${escapeHtml(tema)}</span>
      <span>·</span>
      <span class="diff-pill diff-${escapeHtml(vanske)}">${escapeHtml(vanske)}</span>
      <span>·</span>
      <span>${seenInfo}</span>
    </div>
    <p class="text-lg font-medium mb-4 leading-snug">${escapeHtml(q.sporsmal || '')}</p>
    <div class="mc-alts">${altsHtml}</div>
    ${feedback}
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  if (moduleState.bareNye) {
    return `
      <div class="p-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
        <p class="font-semibold mb-1">Ingen nye spørsmål igjen 🎉</p>
        <p class="text-sm opacity-80">Du har svart riktig på alle innenfor disse filtrene. Slå av "Bare nye" for å øve på nytt.</p>
      </div>
    `;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen spørsmål for disse filtrene</p>
      <p class="text-sm opacity-80">Velg et annet tema eller en annen vanskegrad.</p>
    </div>
  `;
}

// --- Tastatur ---
function onKey(e) {
  if (!location.hash.startsWith('#/multiplechoice')) return;

  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (!moduleState.revealed && /^[1-4]$/.test(e.key)) {
    e.preventDefault();
    answer(parseInt(e.key, 10) - 1);
  } else if (moduleState.revealed && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    nextQuestion();
  }
}

export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;
  moduleState.progress = storage.get(PROGRESS_KEY, {}) || {};
  moduleState.tema = storage.get(TEMA_KEY, 'alle') || 'alle';
  moduleState.vanske = storage.get(VANSKE_KEY, 'alle') || 'alle';
  moduleState.bareNye = !!storage.get(BARENYE_KEY, false);

  rebuildPool();

  const stillValid = moduleState.currentId &&
    moduleState.pool.find((q) => q.id === moduleState.currentId);
  if (!stillValid) {
    moduleState.currentId = pickNext();
    moduleState.selected = null;
    moduleState.revealed = false;
  }

  if (moduleState.keyHandler) {
    document.removeEventListener('keydown', moduleState.keyHandler);
  }
  moduleState.keyHandler = onKey;
  document.addEventListener('keydown', moduleState.keyHandler);

  draw();
}
