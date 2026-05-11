// Matching-modul: klikk-for-å-matche begrep med definisjon.
import * as storage from './storage.js';

const PROGRESS_KEY = 'matching.progress';
const TEMA_KEY = 'matching.tema';
const CURRENT_KEY = 'matching.current';

const moduleState = {
  data: null,
  sets: [],            // alle matching-sett som passer filter
  currentIdx: 0,       // indeks i sets
  rightOrder: [],      // shuffled høyrekolonne for nåværende sett: [origIdx,...]
  matches: {},         // { leftIdx: rightOrigIdx }
  selected: null,      // { side: 'left'|'right', idx }
  checked: false,
  tema: 'alle',
  progress: {},        // { ma-001: { bestScore, attempts, lastSeen } }
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

function rebuildSets() {
  const all = (moduleState.data && moduleState.data.matching) || [];
  moduleState.sets = moduleState.tema === 'alle'
    ? all.slice()
    : all.filter((m) => m.tema === moduleState.tema);
  if (moduleState.currentIdx >= moduleState.sets.length) moduleState.currentIdx = 0;
}

function currentSet() {
  return moduleState.sets[moduleState.currentIdx] || null;
}

function resetSetState() {
  const s = currentSet();
  moduleState.matches = {};
  moduleState.selected = null;
  moduleState.checked = false;
  if (!s) {
    moduleState.rightOrder = [];
    return;
  }
  const n = (s.par || []).length;
  moduleState.rightOrder = shuffle(Array.from({ length: n }, (_, i) => i));
}

function gotoSet(idx) {
  if (idx < 0 || idx >= moduleState.sets.length) return;
  moduleState.currentIdx = idx;
  storage.set(CURRENT_KEY, idx);
  resetSetState();
  draw();
}

function setTema(v) {
  moduleState.tema = v;
  storage.set(TEMA_KEY, v);
  rebuildSets();
  moduleState.currentIdx = 0;
  storage.set(CURRENT_KEY, 0);
  resetSetState();
  draw();
}

// --- Match-logikk ---
function rightMatchedToLeft(rightOrigIdx) {
  for (const [l, r] of Object.entries(moduleState.matches)) {
    if (r === rightOrigIdx) return parseInt(l, 10);
  }
  return null;
}

function clickLeft(leftIdx) {
  if (moduleState.checked) {
    // Lås opp ved klikk – la brukeren rette
    moduleState.checked = false;
  }

  // Hvis allerede matchet → fjern matchen og velg
  if (moduleState.matches[leftIdx] != null) {
    delete moduleState.matches[leftIdx];
    moduleState.selected = { side: 'left', idx: leftIdx };
    draw();
    return;
  }

  // Hvis valgt er på høyre → par
  if (moduleState.selected?.side === 'right') {
    const r = moduleState.selected.idx;
    moduleState.matches[leftIdx] = r;
    moduleState.selected = null;
    draw();
    return;
  }

  // Toggle eget valg
  if (moduleState.selected?.side === 'left' && moduleState.selected.idx === leftIdx) {
    moduleState.selected = null;
  } else {
    moduleState.selected = { side: 'left', idx: leftIdx };
  }
  draw();
}

function clickRight(rightOrigIdx) {
  if (moduleState.checked) {
    moduleState.checked = false;
  }

  // Hvis allerede matchet til en venstre → fjern den matchen og velg
  const existingLeft = rightMatchedToLeft(rightOrigIdx);
  if (existingLeft != null) {
    delete moduleState.matches[existingLeft];
    moduleState.selected = { side: 'right', idx: rightOrigIdx };
    draw();
    return;
  }

  // Hvis valgt er på venstre → par
  if (moduleState.selected?.side === 'left') {
    const l = moduleState.selected.idx;
    moduleState.matches[l] = rightOrigIdx;
    moduleState.selected = null;
    draw();
    return;
  }

  if (moduleState.selected?.side === 'right' && moduleState.selected.idx === rightOrigIdx) {
    moduleState.selected = null;
  } else {
    moduleState.selected = { side: 'right', idx: rightOrigIdx };
  }
  draw();
}

function checkAnswers() {
  const s = currentSet();
  if (!s) return;
  const par = s.par || [];
  const totalPaired = Object.keys(moduleState.matches).length;
  if (totalPaired < par.length) return;

  let correct = 0;
  for (const [l, r] of Object.entries(moduleState.matches)) {
    if (parseInt(l, 10) === r) correct++;
  }
  moduleState.checked = true;
  moduleState.selected = null;

  const id = s.id || ('ma-' + moduleState.currentIdx);
  const cur = moduleState.progress[id] || { bestScore: 0, attempts: 0, lastSeen: 0 };
  cur.attempts = (cur.attempts || 0) + 1;
  cur.bestScore = Math.max(cur.bestScore || 0, correct);
  cur.lastSeen = Date.now();
  cur.lastScore = correct;
  cur.lastTotal = par.length;
  moduleState.progress[id] = cur;
  storage.set(PROGRESS_KEY, moduleState.progress);

  draw();
}

function tryAgain() {
  resetSetState();
  draw();
}

// --- DOM ---
let rootEl = null;

function pairNumberFor(leftIdx) {
  // Tildel "match-nummer" basert på rekkefølgen venstrene ble matchet (sortert)
  const matchedLefts = Object.keys(moduleState.matches)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);
  const idx = matchedLefts.indexOf(leftIdx);
  return idx === -1 ? null : idx + 1;
}

function draw() {
  if (!rootEl) return;
  const temaer = moduleState.data?.temaer || [];
  const temaOptions = ['<option value="alle">Alle temaer</option>']
    .concat(temaer.map((t) =>
      `<option value="${escapeHtml(t.id)}"${moduleState.tema === t.id ? ' selected' : ''}>${escapeHtml(t.navn)}</option>`
    ))
    .join('');

  const totalSets = moduleState.sets.length;
  const s = currentSet();

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Matching</h1>
          <p class="text-sm opacity-70">Klikk et begrep, så en definisjon — eller motsatt.</p>
        </div>
        <div class="text-right text-xs opacity-70">
          <div>Sett: <span class="font-semibold">${totalSets ? moduleState.currentIdx + 1 : 0}/${totalSets}</span></div>
          ${s ? `<div>${escapeHtml(findTema(s.tema))}</div>` : ''}
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap mb-3">
        <label class="text-sm">
          <span class="block text-xs opacity-60 mb-1">Tema</span>
          <select id="ma-tema" class="text-sm px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
            ${temaOptions}
          </select>
        </label>
        <div class="flex items-center gap-1">
          <button id="ma-prev" type="button"
                  ${moduleState.currentIdx <= 0 ? 'disabled' : ''}
                  class="text-sm px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40">
            ← Forrige
          </button>
          <button id="ma-next" type="button"
                  ${moduleState.currentIdx >= totalSets - 1 ? 'disabled' : ''}
                  class="text-sm px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40">
            Neste →
          </button>
        </div>
      </div>

      ${s ? renderSet(s) : renderEmpty()}
    </section>
  `;

  document.getElementById('ma-tema')?.addEventListener('change', (e) => setTema(e.target.value));
  document.getElementById('ma-prev')?.addEventListener('click', () => gotoSet(moduleState.currentIdx - 1));
  document.getElementById('ma-next')?.addEventListener('click', () => gotoSet(moduleState.currentIdx + 1));

  document.querySelectorAll('[data-ma-left]').forEach((el) => {
    el.addEventListener('click', () => clickLeft(parseInt(el.dataset.maLeft, 10)));
  });
  document.querySelectorAll('[data-ma-right]').forEach((el) => {
    el.addEventListener('click', () => clickRight(parseInt(el.dataset.maRight, 10)));
  });
  document.getElementById('ma-check')?.addEventListener('click', checkAnswers);
  document.getElementById('ma-reset')?.addEventListener('click', tryAgain);
  document.getElementById('ma-cont')?.addEventListener('click', () => {
    if (moduleState.currentIdx < moduleState.sets.length - 1) gotoSet(moduleState.currentIdx + 1);
  });
}

function renderSet(s) {
  const par = s.par || [];
  const totalPaired = Object.keys(moduleState.matches).length;
  const allPaired = totalPaired === par.length && par.length > 0;

  const id = s.id || ('ma-' + moduleState.currentIdx);
  const prog = moduleState.progress[id];
  let progressLabel = '';
  if (prog) {
    progressLabel = `Beste: ${prog.bestScore}/${par.length} · Forsøk: ${prog.attempts}`;
  } else {
    progressLabel = 'Ikke prøvd';
  }

  // Venstrekolonne (i original rekkefølge)
  const leftItems = par.map((p, i) => {
    const num = pairNumberFor(i);
    const isSelected = moduleState.selected?.side === 'left' && moduleState.selected.idx === i;
    let cls = 'ma-item';
    if (isSelected) cls += ' is-selected';
    if (num != null) cls += ' is-matched';

    let rightCorrectIdx = null;
    if (moduleState.checked) {
      const r = moduleState.matches[i];
      if (r === i) cls += ' is-correct';
      else cls += ' is-wrong';
      if (r !== i) rightCorrectIdx = i;
    }

    return `
      <button type="button" data-ma-left="${i}" class="${cls}">
        <span class="ma-pip">${num != null ? num : '·'}</span>
        <span class="ma-text">${escapeHtml(p.venstre || '')}</span>
        ${moduleState.checked && rightCorrectIdx != null
          ? `<span class="ma-hint">Skulle vært: ${escapeHtml(par[rightCorrectIdx]?.hoyre || '')}</span>`
          : ''}
      </button>
    `;
  }).join('');

  // Høyrekolonne (i shuffled rekkefølge)
  const rightItems = moduleState.rightOrder.map((origIdx) => {
    const p = par[origIdx];
    const matchedToLeft = rightMatchedToLeft(origIdx);
    const num = matchedToLeft != null ? pairNumberFor(matchedToLeft) : null;
    const isSelected = moduleState.selected?.side === 'right' && moduleState.selected.idx === origIdx;
    let cls = 'ma-item';
    if (isSelected) cls += ' is-selected';
    if (num != null) cls += ' is-matched';
    if (moduleState.checked && matchedToLeft != null) {
      cls += matchedToLeft === origIdx ? ' is-correct' : ' is-wrong';
    }
    return `
      <button type="button" data-ma-right="${origIdx}" class="${cls}">
        <span class="ma-pip">${num != null ? num : '·'}</span>
        <span class="ma-text">${escapeHtml(p?.hoyre || '')}</span>
      </button>
    `;
  }).join('');

  let footer = '';
  if (moduleState.checked) {
    let correct = 0;
    for (const [l, r] of Object.entries(moduleState.matches)) {
      if (parseInt(l, 10) === r) correct++;
    }
    const allCorrect = correct === par.length;
    footer = `
      <div class="mt-4 p-4 rounded-lg ${allCorrect
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
        : 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'}">
        <p class="font-semibold mb-1">${allCorrect ? 'Alle riktige! 🎉' : `Du fikk ${correct}/${par.length} riktig.`}</p>
        <p class="text-sm">Klikk på en rad for å justere, eller "Prøv igjen" for å nullstille.</p>
      </div>
      <div class="mt-3 flex gap-2 flex-wrap">
        <button id="ma-reset" type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-medium">
          Prøv igjen
        </button>
        ${moduleState.currentIdx < moduleState.sets.length - 1
          ? `<button id="ma-cont" type="button"
                     class="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
              Neste sett →
            </button>` : ''}
      </div>
    `;
  } else {
    footer = `
      <div class="mt-4 flex gap-2 flex-wrap items-center">
        <p class="text-sm opacity-70 flex-1">${totalPaired}/${par.length} matchet</p>
        <button id="ma-reset" type="button"
                class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm">
          Nullstill
        </button>
        <button id="ma-check" type="button"
                ${allPaired ? '' : 'disabled'}
                class="px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium disabled:opacity-50">
          Sjekk svar
        </button>
      </div>
    `;
  }

  return `
    <h2 class="text-lg font-semibold mb-1">${escapeHtml(s.tittel || 'Match begrepene')}</h2>
    <p class="text-xs opacity-60 mb-3">${progressLabel}</p>
    <div class="ma-grid">
      <div>
        <p class="text-xs uppercase tracking-wide opacity-60 mb-2">Begrep</p>
        <div class="space-y-2">${leftItems}</div>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide opacity-60 mb-2">Definisjon</p>
        <div class="space-y-2">${rightItems}</div>
      </div>
    </div>
    ${footer}
  `;
}

function renderEmpty() {
  if (!moduleState.data) {
    return `<div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm opacity-80">Laster pensumdata…</div>`;
  }
  return `
    <div class="p-6 rounded-lg bg-slate-50 dark:bg-slate-700/50">
      <p class="font-semibold mb-1">Ingen matching-sett for dette temaet</p>
      <p class="text-sm opacity-80">Velg "Alle temaer".</p>
    </div>
  `;
}

export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;
  moduleState.progress = storage.get(PROGRESS_KEY, {}) || {};
  moduleState.tema = storage.get(TEMA_KEY, 'alle') || 'alle';
  const savedIdx = storage.get(CURRENT_KEY, 0);

  rebuildSets();
  moduleState.currentIdx = Math.min(Math.max(savedIdx | 0, 0), Math.max(moduleState.sets.length - 1, 0));

  // Initialiser sett-state hvis ikke allerede gjort for samme sett
  if (!moduleState.rightOrder.length || moduleState.rightOrder.length !== ((currentSet()?.par || []).length)) {
    resetSetState();
  }

  draw();
}
