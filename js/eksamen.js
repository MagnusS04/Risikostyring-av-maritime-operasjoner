// Eksamen-modus: simulert eksamen med tidtaker.
// Bygger en blandet bunke fra MC + innskriving + regneoppgaver,
// kjører en countdown-timer, lagrer aktiv tilstand i localStorage,
// auto-evaluerer ved levering og viser fasit/forklaring per oppgave.
import * as storage from './storage.js';

const ACTIVE_KEY = 'eksamen.active';
const HISTORY_KEY = 'eksamen.history';
const SETTINGS_KEY = 'eksamen.settings';

// active = {
//   startedAt, varighetMin, finishedAt, submitted,
//   oppgaver: [{ type, id, snapshot }],   // snapshot beholder spørsmålet selv om data.json endres
//   svar: { idx: any }                     // brukerens svar per indeks
// }

const moduleState = {
  data: null,
  active: null,
  view: 'start',         // 'start' | 'inprogress' | 'review'
  currentIdx: 0,
  tickInterval: null,
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

function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

function findTema(id) {
  const t = (moduleState.data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

function parseNumber(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return NaN;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

// --- State helpers ---
function loadActive() {
  moduleState.active = storage.get(ACTIVE_KEY, null);
}

function saveActive() {
  if (moduleState.active) storage.set(ACTIVE_KEY, moduleState.active);
  else storage.remove(ACTIVE_KEY);
}

function clearActive() {
  moduleState.active = null;
  storage.remove(ACTIVE_KEY);
}

function pushToHistory(result) {
  const hist = storage.get(HISTORY_KEY, []) || [];
  hist.unshift(result);
  storage.set(HISTORY_KEY, hist.slice(0, 20));
}

function getSettings() {
  return storage.get(SETTINGS_KEY, { mc: 5, innskriving: 3, regne: 2, varighet: 180 });
}

function saveSettings(s) {
  storage.set(SETTINGS_KEY, s);
}

// --- Build new exam ---
function buildExam(settings) {
  const d = moduleState.data || {};
  const oppgaver = [];

  pickN(d.multiplechoice || [], settings.mc).forEach((q) => {
    oppgaver.push({ type: 'multiplechoice', id: q.id, snapshot: q });
  });
  pickN(d.innskriving || [], settings.innskriving).forEach((q) => {
    oppgaver.push({ type: 'innskriving', id: q.id, snapshot: q });
  });
  pickN(d.regneoppgaver || [], settings.regne).forEach((q) => {
    oppgaver.push({ type: 'regneoppgaver', id: q.id, snapshot: q });
  });

  // Bland all oppgaver
  const blandet = shuffle(oppgaver);

  return {
    startedAt: Date.now(),
    varighetMin: settings.varighet,
    finishedAt: null,
    submitted: false,
    oppgaver: blandet,
    svar: {},
  };
}

function startExam(settings) {
  saveSettings(settings);
  moduleState.active = buildExam(settings);
  saveActive();
  moduleState.view = 'inprogress';
  moduleState.currentIdx = 0;
  startTicker();
  draw();
}

function setSvar(idx, value) {
  if (!moduleState.active || moduleState.active.submitted) return;
  moduleState.active.svar[idx] = value;
  saveActive();
}

function submitExam() {
  if (!moduleState.active || moduleState.active.submitted) return;
  moduleState.active.submitted = true;
  moduleState.active.finishedAt = Date.now();
  saveActive();

  const result = gradeExam(moduleState.active);
  pushToHistory({
    finishedAt: moduleState.active.finishedAt,
    varighetMin: moduleState.active.varighetMin,
    score: result.score,
    total: result.total,
    pct: result.pct,
  });

  stopTicker();
  moduleState.view = 'review';
  draw();
}

function abandonExam() {
  if (!confirm('Avbryt og slett pågående eksamen?')) return;
  clearActive();
  stopTicker();
  moduleState.view = 'start';
  draw();
}

function newExam() {
  clearActive();
  stopTicker();
  moduleState.view = 'start';
  draw();
}

// --- Grading ---
function gradeOppgave(o, svar) {
  if (svar == null) return { gradable: true, correct: false, given: false };
  if (o.type === 'multiplechoice') {
    return {
      gradable: true,
      given: true,
      correct: parseInt(svar, 10) === o.snapshot.rett,
    };
  }
  if (o.type === 'innskriving') {
    const u = normalizeText(svar);
    if (!u) return { gradable: true, correct: false, given: false };
    const accepted = (o.snapshot.godkjenteSvar || []).map(normalizeText);
    return { gradable: true, given: true, correct: accepted.includes(u) };
  }
  if (o.type === 'regneoppgaver') {
    const u = parseNumber(svar);
    if (!Number.isFinite(u)) return { gradable: true, correct: false, given: false };
    const tol = Number.isFinite(o.snapshot.toleranse) ? o.snapshot.toleranse : 0.005;
    return {
      gradable: true,
      given: true,
      correct: Math.abs(u - o.snapshot.svar) <= tol + 1e-12,
    };
  }
  return { gradable: false, correct: false, given: !!svar };
}

function gradeExam(active) {
  const total = active.oppgaver.length;
  let score = 0;
  const perOppgave = active.oppgaver.map((o, i) => {
    const r = gradeOppgave(o, active.svar[i]);
    if (r.correct) score++;
    return { idx: i, ...r };
  });
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, pct, perOppgave };
}

// --- Timer ---
function timeLeftMs() {
  if (!moduleState.active) return 0;
  const start = moduleState.active.startedAt;
  const dur = moduleState.active.varighetMin * 60 * 1000;
  return Math.max(0, start + dur - Date.now());
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function tick() {
  if (!moduleState.active || moduleState.active.submitted) {
    stopTicker();
    return;
  }
  if (!location.hash.startsWith('#/eksamen')) {
    // Når brukeren navigerer bort, stopp tickeren. render() starter den
    // på nytt når man kommer tilbake. timeLeftMs() er uansett basert på
    // startedAt, så tiden går videre uavhengig av om timeren tikker.
    stopTicker();
    return;
  }
  const left = timeLeftMs();
  const el = document.getElementById('eks-timer');
  if (el) {
    el.textContent = fmtTime(left);
    if (left < 5 * 60 * 1000) el.classList.add('text-red-600', 'dark:text-red-400');
  }
  if (left <= 0) {
    submitExam();
  }
}

function startTicker() {
  stopTicker();
  moduleState.tickInterval = setInterval(tick, 1000);
}

function stopTicker() {
  if (moduleState.tickInterval) {
    clearInterval(moduleState.tickInterval);
    moduleState.tickInterval = null;
  }
}

// --- DOM ---
let rootEl = null;

function draw() {
  if (!rootEl) return;

  if (moduleState.view === 'inprogress') {
    drawInProgress();
  } else if (moduleState.view === 'review') {
    drawReview();
  } else {
    drawStart();
  }
}

function drawStart() {
  if (!moduleState.data) {
    rootEl.innerHTML = `<section class="card"><p>Laster…</p></section>`;
    return;
  }
  const d = moduleState.data;
  const settings = getSettings();
  const history = storage.get(HISTORY_KEY, []) || [];

  const counts = {
    mc: (d.multiplechoice || []).length,
    innskriving: (d.innskriving || []).length,
    regne: (d.regneoppgaver || []).length,
  };

  rootEl.innerHTML = `
    <section class="card">
      <h1 class="text-2xl font-bold">Eksamen</h1>
      <p class="text-sm opacity-70 mt-1">
        Sett opp en simulert eksamen. Tidtakeren teller ned, alt lagres lokalt mens du jobber,
        og du får automatisk fasit ved levering.
      </p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        ${numField('eks-mc', 'MC-spørsmål', settings.mc, 0, counts.mc)}
        ${numField('eks-in', 'Innskriving', settings.innskriving, 0, counts.innskriving)}
        ${numField('eks-re', 'Regneoppgaver', settings.regne, 0, counts.regne)}
        ${numField('eks-tid', 'Varighet (min)', settings.varighet, 5, 240)}
      </div>

      <p class="mt-2 text-xs opacity-60">
        Tilgjengelig i pensumdataen: ${counts.mc} MC, ${counts.innskriving} innskriving, ${counts.regne} regneoppgaver.
      </p>

      <button id="eks-start" type="button"
              class="mt-4 w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
        Start eksamen
      </button>
    </section>

    ${history.length ? `
      <section class="card mt-4">
        <h2 class="text-lg font-semibold mb-3">Tidligere forsøk</h2>
        <ul class="space-y-2">
          ${history.slice(0, 5).map((h) => `
            <li class="flex items-center justify-between gap-3 text-sm border-b border-slate-200 dark:border-slate-700 pb-2 last:border-0">
              <span>${escapeHtml(formatDate(h.finishedAt))}</span>
              <span class="font-medium">${h.score}/${h.total} (${h.pct}%)</span>
              <span class="text-xs opacity-60">${h.varighetMin} min</span>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : ''}
  `;

  document.getElementById('eks-start')?.addEventListener('click', () => {
    const newSettings = {
      mc: clamp(parseInt(document.getElementById('eks-mc').value, 10) || 0, 0, counts.mc),
      innskriving: clamp(parseInt(document.getElementById('eks-in').value, 10) || 0, 0, counts.innskriving),
      regne: clamp(parseInt(document.getElementById('eks-re').value, 10) || 0, 0, counts.regne),
      varighet: clamp(parseInt(document.getElementById('eks-tid').value, 10) || 60, 5, 240),
    };
    if (newSettings.mc + newSettings.innskriving + newSettings.regne === 0) {
      alert('Velg minst én oppgave.');
      return;
    }
    startExam(newSettings);
  });
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function numField(id, label, value, min, max) {
  return `
    <label class="block text-sm">
      <span class="block text-xs opacity-60 mb-1">${label}</span>
      <input id="${id}" type="number" min="${min}" max="${max}" value="${value}"
             class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
    </label>
  `;
}

function drawInProgress() {
  const a = moduleState.active;
  if (!a) { moduleState.view = 'start'; draw(); return; }
  const total = a.oppgaver.length;
  const idx = clamp(moduleState.currentIdx, 0, total - 1);
  const o = a.oppgaver[idx];

  const numberedList = a.oppgaver.map((_, i) => {
    const answered = a.svar[i] != null && String(a.svar[i]).trim() !== '';
    let cls = 'eks-num';
    if (i === idx) cls += ' is-current';
    if (answered) cls += ' is-answered';
    return `<button type="button" data-eks-go="${i}" class="${cls}">${i + 1}</button>`;
  }).join('');

  const left = timeLeftMs();

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Eksamen pågår</h1>
          <p class="text-xs opacity-60">Lukk fanen og kom tilbake — fremgangen din lagres automatisk.</p>
        </div>
        <div class="text-right">
          <p class="text-xs opacity-60">Tid igjen</p>
          <p id="eks-timer" class="text-2xl font-mono font-semibold ${left < 5 * 60 * 1000 ? 'text-red-600 dark:text-red-400' : ''}">${fmtTime(left)}</p>
        </div>
      </div>

      <div class="eks-numbers mb-4">${numberedList}</div>

      ${renderActiveOppgave(o, idx)}

      <div class="mt-4 flex gap-2 flex-wrap">
        <button id="eks-prev" type="button" ${idx === 0 ? 'disabled' : ''}
                class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40">
          ← Forrige
        </button>
        <button id="eks-next" type="button" ${idx === total - 1 ? 'disabled' : ''}
                class="flex-1 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40">
          Neste →
        </button>
        <button id="eks-submit" type="button"
                class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          Lever eksamen
        </button>
      </div>
      <p class="mt-3 text-right">
        <button id="eks-abandon" type="button" class="text-xs underline opacity-60 hover:opacity-100">
          Avbryt eksamen
        </button>
      </p>
    </section>
  `;

  // Bind
  document.querySelectorAll('[data-eks-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      moduleState.currentIdx = parseInt(btn.dataset.eksGo, 10);
      draw();
    });
  });
  document.getElementById('eks-prev')?.addEventListener('click', () => {
    if (moduleState.currentIdx > 0) { moduleState.currentIdx--; draw(); }
  });
  document.getElementById('eks-next')?.addEventListener('click', () => {
    if (moduleState.currentIdx < total - 1) { moduleState.currentIdx++; draw(); }
  });
  document.getElementById('eks-submit')?.addEventListener('click', () => {
    const unanswered = a.oppgaver.filter((_, i) => a.svar[i] == null || String(a.svar[i]).trim() === '').length;
    const msg = unanswered > 0
      ? `Du har ${unanswered} ubesvart oppgave(r). Vil du levere likevel?`
      : 'Lever eksamen og se fasit?';
    if (confirm(msg)) submitExam();
  });
  document.getElementById('eks-abandon')?.addEventListener('click', abandonExam);

  bindActiveOppgave(o, idx);
}

function renderActiveOppgave(o, idx) {
  const tema = findTema(o.snapshot.tema);
  const head = `
    <div class="flex items-center gap-2 flex-wrap text-xs opacity-70 mb-2">
      <span class="font-semibold">Oppgave ${idx + 1}</span>
      <span>·</span>
      <span class="uppercase tracking-wide">${typeLabel(o.type)}</span>
      <span>·</span>
      <span>${escapeHtml(tema)}</span>
    </div>
  `;
  if (o.type === 'multiplechoice') return head + renderMC(o, idx);
  if (o.type === 'innskriving') return head + renderIn(o, idx);
  if (o.type === 'regneoppgaver') return head + renderRe(o, idx);
  return head + `<p class="opacity-70">Ukjent oppgavetype.</p>`;
}

function typeLabel(t) {
  return ({
    multiplechoice: 'Multiple choice',
    innskriving: 'Kortsvar',
    regneoppgaver: 'Regneoppgave',
  }[t]) || t;
}

function renderMC(o, idx) {
  const q = o.snapshot;
  const valgt = moduleState.active.svar[idx];
  const altsHtml = (q.alternativer || []).map((alt, i) => {
    const checked = parseInt(valgt, 10) === i;
    return `
      <button type="button" data-eks-mc="${i}" class="mc-alt ${checked ? 'is-selected' : ''}">
        <span class="mc-letter">${String.fromCharCode(65 + i)}</span>
        <span class="mc-text">${escapeHtml(alt)}</span>
      </button>
    `;
  }).join('');
  return `
    <p class="text-base font-medium mb-3 leading-snug">${escapeHtml(q.sporsmal || '')}</p>
    <div class="mc-alts">${altsHtml}</div>
  `;
}

function renderIn(o, idx) {
  const q = o.snapshot;
  const v = moduleState.active.svar[idx] || '';
  return `
    <p class="text-base font-medium mb-3 leading-snug">${escapeHtml(q.sporsmal || '')}</p>
    <input id="eks-in-input" type="text" autocomplete="off" spellcheck="false"
           value="${escapeHtml(v)}"
           placeholder="Skriv svaret…"
           class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none" />
  `;
}

function renderRe(o, idx) {
  const q = o.snapshot;
  const v = moduleState.active.svar[idx] || '';
  const enhet = q.enhet || '';
  return `
    <p class="text-base whitespace-pre-wrap leading-relaxed mb-3">${escapeHtml(q.tekst || '')}</p>
    <div class="flex items-stretch gap-2">
      <input id="eks-re-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
             value="${escapeHtml(v)}"
             placeholder="Tall…"
             class="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none" />
      ${enhet ? `<span class="px-3 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-medium">${escapeHtml(enhet)}</span>` : ''}
    </div>
  `;
}

function bindActiveOppgave(o, idx) {
  if (o.type === 'multiplechoice') {
    document.querySelectorAll('[data-eks-mc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSvar(idx, parseInt(btn.dataset.eksMc, 10));
        draw();
      });
    });
  } else if (o.type === 'innskriving') {
    const inp = document.getElementById('eks-in-input');
    inp?.addEventListener('input', (e) => setSvar(idx, e.target.value));
  } else if (o.type === 'regneoppgaver') {
    const inp = document.getElementById('eks-re-input');
    inp?.addEventListener('input', (e) => setSvar(idx, e.target.value));
  }
}

function drawReview() {
  const a = moduleState.active;
  if (!a) { moduleState.view = 'start'; draw(); return; }
  const result = gradeExam(a);
  const used = a.finishedAt && a.startedAt
    ? Math.round((a.finishedAt - a.startedAt) / 60000)
    : null;

  const cards = a.oppgaver.map((o, i) => {
    const r = result.perOppgave[i];
    const tema = findTema(o.snapshot.tema);
    const userAnswer = a.svar[i];
    return `
      <article class="rounded-lg p-4 border-2 ${r.correct ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/15'
        : r.given ? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/15'
        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30'}">
        <div class="flex items-center gap-2 flex-wrap text-xs opacity-70 mb-1">
          <span class="font-semibold">Oppgave ${i + 1}</span>
          <span>·</span>
          <span>${typeLabel(o.type)}</span>
          <span>·</span>
          <span>${escapeHtml(tema)}</span>
          <span class="ml-auto font-semibold ${r.correct ? 'text-emerald-700 dark:text-emerald-300' : r.given ? 'text-red-700 dark:text-red-300' : ''}">
            ${r.correct ? 'Riktig' : r.given ? 'Feil' : 'Ubesvart'}
          </span>
        </div>
        ${reviewBody(o, userAnswer)}
      </article>
    `;
  }).join('');

  rootEl.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 class="text-2xl font-bold">Eksamenresultat</h1>
          <p class="text-sm opacity-70">${escapeHtml(formatDate(a.finishedAt))}${used != null ? ` · brukt ${used} min av ${a.varighetMin}` : ''}</p>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold">${result.score}/${result.total}</p>
          <p class="text-sm opacity-70">${result.pct}%</p>
        </div>
      </div>
      <div class="progressbar mb-2"><div style="width:${result.pct}%"></div></div>
      <p class="text-xs opacity-60 mb-4">Karakter er ikke beregnet — bruk dette som indikator.</p>

      <div class="flex gap-2 flex-wrap">
        <button id="eks-newexam" type="button"
                class="px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white font-medium">
          Ny eksamen
        </button>
        <a href="#/analyse"
           class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-medium">
          Se total statistikk →
        </a>
      </div>
    </section>

    <section class="mt-4 space-y-3">
      ${cards}
    </section>
  `;

  document.getElementById('eks-newexam')?.addEventListener('click', newExam);
}

function reviewBody(o, userAnswer) {
  const q = o.snapshot;
  if (o.type === 'multiplechoice') {
    const valgt = parseInt(userAnswer, 10);
    const alts = (q.alternativer || []).map((alt, i) => {
      let cls = 'mc-alt';
      if (i === q.rett) cls += ' is-correct';
      else if (i === valgt) cls += ' is-wrong';
      else cls += ' is-other';
      return `
        <div class="${cls}">
          <span class="mc-letter">${String.fromCharCode(65 + i)}</span>
          <span class="mc-text">${escapeHtml(alt)}</span>
        </div>
      `;
    }).join('');
    return `
      <p class="text-sm font-medium mb-2">${escapeHtml(q.sporsmal || '')}</p>
      <div class="mc-alts">${alts}</div>
      ${q.forklaring ? `<p class="text-sm mt-3 opacity-80"><span class="font-semibold">Forklaring:</span> ${escapeHtml(q.forklaring)}</p>` : ''}
      ${q.kilde ? `<p class="text-xs opacity-60 mt-1">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}
    `;
  }
  if (o.type === 'innskriving') {
    const accepted = q.godkjenteSvar || [];
    return `
      <p class="text-sm font-medium mb-2">${escapeHtml(q.sporsmal || '')}</p>
      <p class="text-sm"><span class="opacity-70">Ditt svar:</span> ${escapeHtml(userAnswer || '(intet)')}</p>
      <p class="text-sm"><span class="opacity-70">Fasit:</span> ${escapeHtml(accepted[0] || '')}</p>
      ${accepted.length > 1 ? `<p class="text-xs opacity-70">Også godkjent: ${accepted.slice(1).map(escapeHtml).join(', ')}</p>` : ''}
      ${q.forklaring ? `<p class="text-sm mt-2 opacity-80">${escapeHtml(q.forklaring)}</p>` : ''}
      ${q.kilde ? `<p class="text-xs opacity-60 mt-1">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}
    `;
  }
  if (o.type === 'regneoppgaver') {
    const enhet = q.enhet || '';
    const tol = Number.isFinite(q.toleranse) ? q.toleranse : 0.005;
    const u = parseNumber(userAnswer);
    return `
      <p class="text-sm whitespace-pre-wrap mb-2">${escapeHtml(q.tekst || '')}</p>
      <p class="text-sm"><span class="opacity-70">Ditt svar:</span> ${Number.isFinite(u) ? formatNumberPretty(u) : '(intet)'}${enhet ? ' ' + escapeHtml(enhet) : ''}</p>
      <p class="text-sm"><span class="opacity-70">Fasit:</span> ${formatNumberPretty(q.svar)}${enhet ? ' ' + escapeHtml(enhet) : ''} <span class="text-xs opacity-60">(±${formatNumberPretty(tol)})</span></p>
      ${q.losning ? `<details class="mt-2"><summary class="cursor-pointer text-sm font-medium">Steg-for-steg løsning</summary><p class="mt-1 text-sm whitespace-pre-wrap opacity-90">${escapeHtml(q.losning)}</p></details>` : ''}
      ${q.kilde ? `<p class="text-xs opacity-60 mt-1">Kilde: ${escapeHtml(q.kilde)}</p>` : ''}
    `;
  }
  return '';
}

function formatNumberPretty(n) {
  if (!Number.isFinite(n)) return '—';
  return String(n).replace('.', ',');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('no-NO');
}

// --- Eksport ---
export function teardown() {
  stopTicker();
}

export function render(container, appState) {
  rootEl = container;
  moduleState.data = appState?.data || null;

  loadActive();

  if (moduleState.active) {
    if (moduleState.active.submitted) {
      moduleState.view = 'review';
    } else if (timeLeftMs() <= 0) {
      // Tid har løpt ut mens vi var borte – auto-lever
      submitExam();
      return;
    } else {
      moduleState.view = 'inprogress';
      startTicker();
    }
  } else {
    moduleState.view = 'start';
  }

  draw();
}
