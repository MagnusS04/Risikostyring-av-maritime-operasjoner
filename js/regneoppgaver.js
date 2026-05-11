// Regneoppgaver: numerisk svar med toleranse + steg-for-steg løsning.
import * as storage from './storage.js';

const PROGRESS_KEY = 'regneoppgaver.progress';
const TEMA_KEY = 'regneoppgaver.tema';

const moduleState = {
  data: null,
  pool: [],
  queue: [],
  currentId: null,
  input: '',
  revealed: false,
  wasCorrect: false,
  parsedInput: null,
  tema: 'alle',
  progress: {},
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
  const all = (moduleState.data && moduleState.data.regneoppgaver) || [];
  moduleState.pool = moduleState.tema === 'alle'
    ? all.slice()
    : all.filter((q) => q.tema === moduleState.tema);
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

function parseNumber(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return NaN;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  // Norsk visning med komma som desimaltegn
  const abs = Math.abs(n);
  let s;
  if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) {
    s = n.toExponential(3);
  } else {
    s = n.toFixed(Math.max(0, Math.min(6, decimals(n))));
  }
  return s.replace('.', ',');
}

function decimals(n) {
  const s = String(n);
  if (s.includes('e')) return 6;
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

function checkAnswer() {
  if (moduleState.revealed) return;
  const q = getCurrentQ();
  if (!q) return;
  if (!moduleState.input.trim()) return;

  const u = parseNumber(moduleState.input);
  if (!Number.isFinite(u)) {
    // Vis som feil med beskjed
    moduleState.revealed = true;
    moduleState.wasCorrect = false;
    moduleState.parsedInput = NaN;
  } else {
    const tol = Number.isFinite(q.toleranse) ? q.toleranse : 0.005;
    const ok = Math.abs(u - q.svar) <= tol + 1e-12;
    moduleState.revealed = true;
    moduleState.wasCorrect = ok;
    moduleState.parsedInput = u;

    const cur = { ...getEntry(q.id) };
    if (ok) cur.correct = (cur.correct || 0) + 1;
    else cur.wrong = (cur.wrong || 0) + 1;
    cur.lastCorrect = ok;
    cur.lastSeen = Date.now();
    moduleState.progress[q.id] = cur;
    storage.set(PROGRESS_KEY, moduleState.progress);

    moduleState.sessionAnswered++;
    if (ok) moduleState.sessionCorrect++;
  }

  draw();
}

function nextQuestion() {
  moduleState.currentId = pickNext();
  moduleState.input = '';
  moduleState.parsedInput = null;
  moduleState.revealed = false;
  moduleState.wasCorrect = false;
  draw();
}

function setTema(v) {
  moduleState.tema = v;
  storage.set(TEMA_KEY, v);
  rebuildPool();
  moduleState.currentId = pickNext();
  moduleState.input = '';
  moduleState.parsedInput = null;
  moduleState.revealed = false;
  moduleState.wasCorrect = false;
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

  const sessionRatio = moduleState.sessionAnswered > 0
    ? Math.round((moduleState.sessionCorrect / moduleState.sessionAnswered) * 100)
    : 0;

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Regneoppgaver</h1>
          <p class="text-sm opacity-70">Skriv tallet. Komma og punktum godtas begge.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>Sesjon: <span class="font-semibold">${moduleState.sessionCorrect}/${moduleState.sessionAnswered}</span> (${sessionRatio}%)</div>
          <div>I bunken: <span class="font-semibold">${stats.total}</span></div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="re-tema" class="text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${temaOptions}
          </select>
        </label>
        <div class="flex items-center gap-2 text-xs">
          <span class="diff-pill diff-lett">${stats.riktig} riktig sist</span>
          <span class="diff-pill diff-vanskelig">${stats.feil} feil sist</span>
          <span class="diff-pill" style="background:#e2e8f0;color:#334155">${stats.urort} urørt</span>
        </div>
      </div>

      ${q ? renderQuestion(q) : renderEmpty()}

      <p class="mt-4 text-xs opacity-60">
        Tastatur: <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> sjekker svaret,
        <kbd class="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> igjen går til neste.
      </p>
    </section>
  `;

  document.getElementById('re-tema')?.addEventListener('change', (e) => setTema(e.target.value));

  const input = document.getElementById('re-input');
  if (input) {
    input.addEventListener('input', (e) => {
      moduleState.input = e.target.value;
    });
    if (!moduleState.revealed) {
      input.focus();
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (e) {}
    }
  }

  document.getElementById('re-check')?.addEventListener('click', checkAnswer);
  document.getElementById('re-next')?.addEventListener('click', nextQuestion);
}

function renderQuestion(q) {
  const tema = findTema(q.tema);
  const e = getEntry(q.id);
  const seenInfo = (e.correct || e.wrong)
    ? `Sett før: ${e.correct} ✓ / ${e.wrong} ✗`
    : 'Ny oppgave';
  const enhet = q.enhet || '';
  const tol = Number.isFinite(q.toleranse) ? q.toleranse : 0.005;

  let body = '';
  if (!moduleState.revealed) {
    body = `
      <div class="mt-4">
        <label for="re-input" class="block text-xs opacity-60 mb-1">Ditt svar</label>
        <div class="flex items-stretch gap-2">
          <input id="re-input"
                 type="text"
                 inputmode="decimal"
                 autocomplete="off"
                 spellcheck="false"
                 value="${escapeHtml(moduleState.input)}"
                 placeholder="f.eks. 0,02"
                 class="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none text-base" />
          ${enhet ? `<span class="px-3 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-medium">${escapeHtml(enhet)}</span>` : ''}
        </div>
        <p class="text-xs opacity-60 mt-2">Toleranse: ±${formatNumber(tol)}${enhet ? ' ' + escapeHtml(enhet) : ''}</p>
        <button id="re-check" type="button"
                class="mt-3 w-full px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
          Sjekk svar
        </button>
      </div>
    `;
  } else {
    const validInput = Number.isFinite(moduleState.parsedInput);
    const userVal = validInput ? formatNumber(moduleState.parsedInput) : '(ugyldig tall)';
    const correctVal = formatNumber(q.svar);

    body = `
      <div class="mt-4 p-4 rounded-lg ${moduleState.wasCorrect
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
        : 'bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100'}">
        <p class="font-semibold mb-1">${moduleState.wasCorrect ? 'Riktig!' : 'Feil.'}</p>
        <p class="text-sm">
          <span class="opacity-70">Ditt svar:</span>
          <span class="font-medium">${escapeHtml(userVal)}${enhet ? ' ' + escapeHtml(enhet) : ''}</span>
        </p>
        <p class="text-sm mt-1">
          <span class="opacity-70">Fasit:</span>
          <span class="font-medium">${escapeHtml(correctVal)}${enhet ? ' ' + escapeHtml(enhet) : ''}</span>
          <span class="opacity-70 text-xs"> (±${formatNumber(tol)})</span>
        </p>
      </div>

      ${q.losning ? `
        <details class="mt-3 rounded-lg border border-slate-200 dark:border-slate-700" open>
          <summary class="cursor-pointer px-4 py-2 font-medium select-none bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            Steg-for-steg løsning
          </summary>
          <div class="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">${escapeHtml(q.losning)}</div>
        </details>` : ''}

      ${q.kilde ? `<p class="text-xs opacity-70 mt-2">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}

      <button id="re-next" type="button"
              class="mt-3 w-full px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
        Neste oppgave →
      </button>
    `;
  }

  return `
    <div class="mb-2 flex items-center gap-2 flex-wrap text-xs opacity-70">
      <span>${escapeHtml(tema)}</span>
      <span>·</span>
      <span>${seenInfo}</span>
    </div>
    <p class="text-base leading-relaxed whitespace-pre-wrap">${escapeHtml(q.tekst || '')}</p>
    ${body}
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen regneoppgaver for dette temaet</p>
      <p class="text-sm opacity-80">Velg "Alle temaer".</p>
    </div>
  `;
}

// --- Tastatur ---
function onKey(e) {
  if (!location.hash.startsWith('#/regneoppgaver')) return;

  if (e.key === 'Enter') {
    if (moduleState.revealed) {
      e.preventDefault();
      nextQuestion();
    } else if ((e.target?.tagName || '').toLowerCase() === 'input' && e.target?.id === 're-input') {
      e.preventDefault();
      checkAnswer();
    }
  }
}

export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;
  moduleState.progress = storage.get(PROGRESS_KEY, {}) || {};
  moduleState.tema = storage.get(TEMA_KEY, 'alle') || 'alle';

  rebuildPool();

  const stillValid = moduleState.currentId &&
    moduleState.pool.find((q) => q.id === moduleState.currentId);
  if (!stillValid) {
    moduleState.currentId = pickNext();
    moduleState.input = '';
    moduleState.parsedInput = null;
    moduleState.revealed = false;
    moduleState.wasCorrect = false;
  }

  if (moduleState.keyHandler) {
    document.removeEventListener('keydown', moduleState.keyHandler);
  }
  moduleState.keyHandler = onKey;
  document.addEventListener('keydown', moduleState.keyHandler);

  draw();
}
