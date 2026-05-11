// Langsvar-modul: eksamenstype-oppgaver med tekstområde + modellsvar
// + selvevaluering (godt / delvis / må øve mer).
import * as storage from './storage.js';

const PROGRESS_KEY = 'langsvar.progress';
const ANSWERS_KEY = 'langsvar.answers';
const TEMA_KEY = 'langsvar.tema';
const VANSKE_KEY = 'langsvar.vanske';

const moduleState = {
  data: null,
  pool: [],
  currentId: null,
  revealed: false,
  tema: 'alle',
  vanske: 'alle',
  progress: {},     // { ls-001: { godt, delvis, oveMer, lastEval, lastSeen } }
  answers: {},      // { ls-001: "user's text" }
  keyHandler: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function findTema(id) {
  const t = (moduleState.data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

function getEntry(id) {
  return moduleState.progress[id] || { godt: 0, delvis: 0, oveMer: 0, lastEval: null, lastSeen: 0 };
}

function getWeight(id) {
  const e = moduleState.progress[id];
  if (!e) return 1;
  if (e.lastEval === 'oveMer') return 4;
  if (e.lastEval === 'delvis') return 2;
  if (e.lastEval === 'godt') return 0.5;
  return 1;
}

function rebuildPool() {
  const all = (moduleState.data && moduleState.data.langsvar) || [];
  moduleState.pool = all.filter((q) => {
    if (moduleState.tema !== 'alle' && q.tema !== moduleState.tema) return false;
    if (moduleState.vanske !== 'alle' && q.vanskegrad !== moduleState.vanske) return false;
    return true;
  });
}

function pickNext() {
  const pool = moduleState.pool;
  if (!pool.length) return null;
  const weights = pool.map((q) => {
    let w = getWeight(q.id);
    if (q.id === moduleState.currentId) w *= 0.05;
    return Math.max(w, 0.01);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

function getCurrentQ() {
  return moduleState.pool.find((q) => q.id === moduleState.currentId) || null;
}

function setAnswer(text) {
  if (!moduleState.currentId) return;
  moduleState.answers[moduleState.currentId] = text;
  storage.set(ANSWERS_KEY, moduleState.answers);
}

function reveal() {
  if (moduleState.revealed) return;
  moduleState.revealed = true;
  draw();
}

function evaluate(level) {
  const q = getCurrentQ();
  if (!q) return;
  const cur = { ...getEntry(q.id) };
  if (level === 'godt') cur.godt = (cur.godt || 0) + 1;
  else if (level === 'delvis') cur.delvis = (cur.delvis || 0) + 1;
  else if (level === 'oveMer') cur.oveMer = (cur.oveMer || 0) + 1;
  cur.lastEval = level;
  cur.lastSeen = Date.now();
  moduleState.progress[q.id] = cur;
  storage.set(PROGRESS_KEY, moduleState.progress);
  next();
}

function next() {
  moduleState.currentId = pickNext();
  moduleState.revealed = false;
  draw();
}

function setTema(v) {
  moduleState.tema = v;
  storage.set(TEMA_KEY, v);
  rebuildPool();
  moduleState.currentId = pickNext();
  moduleState.revealed = false;
  draw();
}

function setVanske(v) {
  moduleState.vanske = v;
  storage.set(VANSKE_KEY, v);
  rebuildPool();
  moduleState.currentId = pickNext();
  moduleState.revealed = false;
  draw();
}

// --- DOM ---
let rootEl = null;

function poolStats() {
  let godt = 0, delvis = 0, ovemer = 0, urort = 0;
  for (const q of moduleState.pool) {
    const e = moduleState.progress[q.id];
    if (!e) urort++;
    else if (e.lastEval === 'godt') godt++;
    else if (e.lastEval === 'delvis') delvis++;
    else if (e.lastEval === 'oveMer') ovemer++;
  }
  return { total: moduleState.pool.length, godt, delvis, ovemer, urort };
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

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Langsvar / eksamensoppgaver</h1>
          <p class="text-sm opacity-70">Skriv et eksamens-svar. Sammenlign med modellsvar, og vurder selv.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>I bunken: <span class="font-semibold">${stats.total}</span></div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="ls-tema" class="w-full text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${temaOptions}
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Vanskegrad</span>
          <select id="ls-vanske" class="w-full text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${vanskeOptions}
          </select>
        </label>
      </div>

      <div class="flex items-center gap-2 text-xs mb-4">
        <span class="diff-pill diff-lett">${stats.godt} godt</span>
        <span class="diff-pill diff-middels">${stats.delvis} delvis</span>
        <span class="diff-pill diff-vanskelig">${stats.ovemer} må øve</span>
        <span class="diff-pill" style="background:#e2e8f0;color:#334155">${stats.urort} urørt</span>
      </div>

      ${q ? renderQuestion(q) : renderEmpty()}
    </section>
  `;

  document.getElementById('ls-tema')?.addEventListener('change', (e) => setTema(e.target.value));
  document.getElementById('ls-vanske')?.addEventListener('change', (e) => setVanske(e.target.value));

  const ta = document.getElementById('ls-textarea');
  if (ta) {
    ta.addEventListener('input', (e) => setAnswer(e.target.value));
  }
  document.getElementById('ls-reveal')?.addEventListener('click', reveal);
  document.getElementById('ls-skip')?.addEventListener('click', next);
  document.getElementById('ls-evalGodt')?.addEventListener('click', () => evaluate('godt'));
  document.getElementById('ls-evalDelvis')?.addEventListener('click', () => evaluate('delvis'));
  document.getElementById('ls-evalOveMer')?.addEventListener('click', () => evaluate('oveMer'));
}

function renderQuestion(q) {
  const tema = findTema(q.tema);
  const vanske = q.vanskegrad || 'middels';
  const e = getEntry(q.id);
  const seenInfo = (e.godt || e.delvis || e.oveMer)
    ? `Sett før: ${e.godt} godt · ${e.delvis} delvis · ${e.oveMer} må øve`
    : 'Ny oppgave';

  const userAnswer = moduleState.answers[q.id] || '';
  const stikkord = Array.isArray(q.stikkord) && q.stikkord.length
    ? `<div class="mt-2 flex flex-wrap gap-1">${q.stikkord.map((s) => `<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">${escapeHtml(s)}</span>`).join('')}</div>`
    : '';

  let bottom = '';
  if (!moduleState.revealed) {
    bottom = `
      <div class="mt-3 flex flex-wrap gap-2">
        <button id="ls-reveal" type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
          Vis modellsvar
        </button>
        <button id="ls-skip" type="button"
                class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">
          Hopp over
        </button>
      </div>
    `;
  } else {
    bottom = `
      <details class="mt-4 rounded-lg border border-slate-200 dark:border-slate-700" open>
        <summary class="cursor-pointer px-4 py-2 font-medium select-none bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          Modellsvar
        </summary>
        <div class="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">${escapeHtml(q.modellsvar || '')}</div>
      </details>

      ${stikkord ? `<div class="mt-3"><p class="text-xs opacity-60 mb-1">Sentrale stikkord du burde nevne:</p>${stikkord}</div>` : ''}

      ${q.kilde ? `<p class="text-xs opacity-70 mt-3">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}

      <div class="mt-4">
        <p class="text-sm font-medium mb-2">Hvor godt dekket svaret ditt fasiten?</p>
        <div class="grid grid-cols-3 gap-2">
          <button id="ls-evalOveMer" type="button"
                  class="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm">
            Må øve mer
          </button>
          <button id="ls-evalDelvis" type="button"
                  class="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm">
            Delvis
          </button>
          <button id="ls-evalGodt" type="button"
                  class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm">
            Godt
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="mb-2 flex items-center gap-2 flex-wrap text-xs opacity-70">
      ${q.tittel ? `<span class="font-semibold">${escapeHtml(q.tittel)}</span><span>·</span>` : ''}
      <span>${escapeHtml(tema)}</span>
      <span>·</span>
      <span class="diff-pill diff-${escapeHtml(vanske)}">${escapeHtml(vanske)}</span>
      <span>·</span>
      <span>${seenInfo}</span>
    </div>
    <p class="text-base whitespace-pre-wrap leading-relaxed mb-3">${escapeHtml(q.sporsmal || '')}</p>

    <label for="ls-textarea" class="block text-xs opacity-60 mb-1">Ditt svar (lagres automatisk)</label>
    <textarea id="ls-textarea"
              rows="8"
              placeholder="Skriv et eksamens-svar her. Struktur: definer begreper, drøft, gi eksempler. Husk faglige stikkord."
              class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none text-sm leading-relaxed resize-y">${escapeHtml(userAnswer)}</textarea>

    ${bottom}
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen langsvar-oppgaver for disse filtrene</p>
      <p class="text-sm opacity-80">Velg "Alle temaer" og "Alle nivåer".</p>
    </div>
  `;
}

export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;
  moduleState.progress = storage.get(PROGRESS_KEY, {}) || {};
  moduleState.answers = storage.get(ANSWERS_KEY, {}) || {};
  moduleState.tema = storage.get(TEMA_KEY, 'alle') || 'alle';
  moduleState.vanske = storage.get(VANSKE_KEY, 'alle') || 'alle';

  rebuildPool();

  const stillValid = moduleState.currentId &&
    moduleState.pool.find((q) => q.id === moduleState.currentId);
  if (!stillValid) {
    moduleState.currentId = pickNext();
    moduleState.revealed = false;
  }

  draw();
}
