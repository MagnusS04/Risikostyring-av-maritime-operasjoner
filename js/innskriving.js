// Innskrivingsmodul: tekstsvar med flere godkjente formuleringer.
import * as storage from './storage.js';

const PROGRESS_KEY = 'innskriving.progress';
const TEMA_KEY = 'innskriving.tema';

const moduleState = {
  data: null,
  pool: [],
  queue: [],
  currentId: null,
  input: '',
  revealed: false,
  wasCorrect: false,
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

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

function findTema(id) {
  const t = (moduleState.data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

function getEntry(id) {
  return moduleState.progress[id] || { correct: 0, wrong: 0, lastCorrect: null, lastSeen: 0 };
}

function rebuildPool() {
  const all = (moduleState.data && moduleState.data.innskriving) || [];
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

function checkAnswer() {
  if (moduleState.revealed) return;
  const q = getCurrentQ();
  if (!q) return;

  const userInput = moduleState.input;
  if (!userInput.trim()) return; // ikke aksepter tomt

  const u = normalize(userInput);
  const accepted = (q.godkjenteSvar || []).map(normalize);
  const correct = accepted.includes(u);

  moduleState.revealed = true;
  moduleState.wasCorrect = correct;

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
  moduleState.input = '';
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
          <h1 class="text-2xl font-bold">Innskriving</h1>
          <p class="text-sm opacity-70">Skriv svaret. Flere formuleringer aksepteres.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>Sesjon: <span class="font-semibold">${moduleState.sessionCorrect}/${moduleState.sessionAnswered}</span> (${sessionRatio}%)</div>
          <div>I bunken: <span class="font-semibold">${stats.total}</span></div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="in-tema" class="text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
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

  document.getElementById('in-tema')?.addEventListener('change', (e) => setTema(e.target.value));

  const input = document.getElementById('in-input');
  if (input) {
    input.addEventListener('input', (e) => {
      moduleState.input = e.target.value;
    });
    if (!moduleState.revealed) {
      // Behold fokus mens man skriver
      input.focus();
      // Plasser caret bak teksten
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (e) {}
    }
  }

  document.getElementById('in-check')?.addEventListener('click', checkAnswer);
  document.getElementById('in-next')?.addEventListener('click', nextQuestion);
}

function renderQuestion(q) {
  const tema = findTema(q.tema);
  const e = getEntry(q.id);
  const seenInfo = (e.correct || e.wrong)
    ? `Sett før: ${e.correct} ✓ / ${e.wrong} ✗`
    : 'Nytt spørsmål';

  let inputBlock = '';
  if (!moduleState.revealed) {
    inputBlock = `
      <div class="mt-4">
        <label for="in-input" class="block text-xs opacity-60 mb-1">Ditt svar</label>
        <input id="in-input"
               type="text"
               autocomplete="off"
               autocapitalize="off"
               spellcheck="false"
               value="${escapeHtml(moduleState.input)}"
               placeholder="Skriv inn svaret…"
               class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none text-base" />
        <button id="in-check" type="button"
                class="mt-3 w-full px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
          Sjekk svar
        </button>
      </div>
    `;
  } else {
    const accepted = q.godkjenteSvar || [];
    const canonical = accepted[0] || '';
    inputBlock = `
      <div class="mt-4 p-4 rounded-lg ${moduleState.wasCorrect
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
        : 'bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100'}">
        <p class="font-semibold mb-1">${moduleState.wasCorrect ? 'Riktig!' : 'Feil.'}</p>
        <p class="text-sm">
          <span class="opacity-70">Ditt svar:</span>
          <span class="font-medium">${escapeHtml(moduleState.input)}</span>
        </p>
        <p class="text-sm mt-1">
          <span class="opacity-70">Fasit:</span>
          <span class="font-medium">${escapeHtml(canonical)}</span>
        </p>
        ${accepted.length > 1
          ? `<p class="text-xs opacity-70 mt-1">Også godkjent: ${accepted.slice(1).map(escapeHtml).join(', ')}</p>`
          : ''}
        ${q.forklaring ? `<p class="text-sm mt-2">${escapeHtml(q.forklaring)}</p>` : ''}
        ${q.kilde ? `<p class="text-xs opacity-70 mt-2">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}
      </div>
      <button id="in-next" type="button"
              class="mt-3 w-full px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
        Neste spørsmål →
      </button>
    `;
  }

  return `
    <div class="mb-2 flex items-center gap-2 flex-wrap text-xs opacity-70">
      <span>${escapeHtml(tema)}</span>
      <span>·</span>
      <span>${seenInfo}</span>
    </div>
    <p class="text-lg font-medium leading-snug">${escapeHtml(q.sporsmal || '')}</p>
    ${inputBlock}
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen spørsmål for dette temaet</p>
      <p class="text-sm opacity-80">Velg "Alle temaer" eller et annet tema.</p>
    </div>
  `;
}

// --- Tastatur ---
function onKey(e) {
  if (!location.hash.startsWith('#/innskriving')) return;

  if (e.key === 'Enter') {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (moduleState.revealed) {
      e.preventDefault();
      nextQuestion();
    } else if (tag === 'input' && e.target?.id === 'in-input') {
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
