// Analyse-modul: aggregert statistikk på tvers av alle moduler.
// Leser progress fra localStorage, krysstabell tema × oppgavetype,
// liste over feilbesvarte spørsmål, og siste eksamensresultater.
import * as storage from './storage.js';

const TYPES = [
  { key: 'flashcards', label: 'Flashcards', dataKey: 'flashcards', storageKey: 'flashcards.progress', route: '#/flashcards' },
  { key: 'multiplechoice', label: 'Multiple choice', dataKey: 'multiplechoice', storageKey: 'multiplechoice.progress', route: '#/multiplechoice' },
  { key: 'innskriving', label: 'Innskriving', dataKey: 'innskriving', storageKey: 'innskriving.progress', route: '#/innskriving' },
  { key: 'regneoppgaver', label: 'Regneoppgaver', dataKey: 'regneoppgaver', storageKey: 'regneoppgaver.progress', route: '#/regneoppgaver' },
];

let rootEl = null;
let appData = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function findTema(id) {
  const t = (appData?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

// Returnerer { perType: { ts: { total, sett, riktig, feil } },
//              perTema: { temaId: { total, sett, riktig, feil, perType: {...} } },
//              feilbesvarte: [{type, q, e}] }
function aggregate() {
  const out = {
    perType: {},
    perTema: {},
    feilbesvarte: [],
    totals: { total: 0, sett: 0, riktig: 0, feil: 0 },
  };

  for (const t of TYPES) {
    const all = (appData?.[t.dataKey]) || [];
    const prog = storage.get(t.storageKey, {}) || {};
    const ts = { total: all.length, sett: 0, riktig: 0, feil: 0 };

    for (const q of all) {
      const e = prog[q.id];
      const tema = q.tema || 'ukjent';

      // Init per-tema
      if (!out.perTema[tema]) {
        out.perTema[tema] = {
          total: 0, sett: 0, riktig: 0, feil: 0,
          perType: {},
        };
      }
      out.perTema[tema].total++;
      if (!out.perTema[tema].perType[t.key]) {
        out.perTema[tema].perType[t.key] = { total: 0, riktig: 0, feil: 0 };
      }
      out.perTema[tema].perType[t.key].total++;

      if (!e) continue;

      // For flashcards bruker vi vekt: weight <= 0.5 = "kunne", weight > 1 = "feil"
      let isCorrect = false;
      let isWrong = false;
      if (t.key === 'flashcards') {
        const w = e.weight ?? 1;
        isCorrect = (e.correct || 0) > 0 && w <= 0.5;
        isWrong = (e.wrong || 0) > 0 && w > 1;
      } else {
        isCorrect = !!e.lastCorrect;
        isWrong = e.lastCorrect === false;
      }

      ts.sett++;
      out.perTema[tema].sett++;
      out.totals.sett++;

      if (isCorrect) {
        ts.riktig++;
        out.perTema[tema].riktig++;
        out.perTema[tema].perType[t.key].riktig++;
        out.totals.riktig++;
      }
      if (isWrong) {
        ts.feil++;
        out.perTema[tema].feil++;
        out.perTema[tema].perType[t.key].feil++;
        out.totals.feil++;
        out.feilbesvarte.push({ type: t, q, e });
      }
    }

    out.perType[t.key] = ts;
    out.totals.total += ts.total;
  }

  return out;
}

// Heatmap-farge fra ratio (0-1) av riktig/(riktig+feil), eller grå hvis 0 sett
function heatColor(riktig, feil) {
  const sum = riktig + feil;
  if (sum === 0) return 'background-color:rgba(148,163,184,.18);color:rgb(100 116 139)';
  const r = riktig / sum;
  // Røde-grønne gradient
  if (r >= 0.85) return 'background-color:#16a34a;color:white';
  if (r >= 0.6) return 'background-color:#84cc16;color:#1f2937';
  if (r >= 0.4) return 'background-color:#facc15;color:#1f2937';
  if (r >= 0.2) return 'background-color:#f97316;color:white';
  return 'background-color:#dc2626;color:white';
}

function renderTotals(stats) {
  const t = stats.totals;
  const ratio = (t.riktig + t.feil) > 0 ? Math.round((t.riktig / (t.riktig + t.feil)) * 100) : 0;
  return `
    <section class="card">
      <h1 class="text-2xl font-bold">Analyse</h1>
      <p class="text-sm opacity-70 mt-1">Aggregert fra all øvelse du har gjort lokalt.</p>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        ${tile('Totalt i pensum', t.total)}
        ${tile('Sett', t.sett)}
        ${tile('Riktig sist', t.riktig, 'text-emerald-600 dark:text-emerald-300')}
        ${tile('Feil sist', t.feil, 'text-red-600 dark:text-red-300')}
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-baseline text-sm mb-1">
          <span class="opacity-70">Andel riktige (av sett)</span>
          <span class="font-semibold">${ratio}%</span>
        </div>
        <div class="progressbar"><div style="width:${ratio}%"></div></div>
      </div>
    </section>
  `;
}

function tile(label, value, valueClass = '') {
  return `
    <div class="rounded-lg p-3 bg-slate-50 dark:bg-slate-700/50">
      <p class="text-xs opacity-60">${escapeHtml(label)}</p>
      <p class="text-2xl font-bold ${valueClass}">${value}</p>
    </div>
  `;
}

function renderPerType(stats) {
  const rows = TYPES.map((t) => {
    const s = stats.perType[t.key] || { total: 0, sett: 0, riktig: 0, feil: 0 };
    const ratio = (s.riktig + s.feil) > 0 ? Math.round((s.riktig / (s.riktig + s.feil)) * 100) : null;
    return `
      <tr class="border-t border-slate-200 dark:border-slate-700">
        <td class="py-2 pr-3"><a href="${t.route}" class="hover:underline">${t.label}</a></td>
        <td class="py-2 pr-3 text-right tabular-nums">${s.sett}/${s.total}</td>
        <td class="py-2 pr-3 text-right tabular-nums text-emerald-600 dark:text-emerald-300">${s.riktig}</td>
        <td class="py-2 pr-3 text-right tabular-nums text-red-600 dark:text-red-300">${s.feil}</td>
        <td class="py-2 text-right tabular-nums">${ratio == null ? '—' : ratio + '%'}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-2">Per oppgavetype</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs uppercase opacity-60">
              <th class="py-1 pr-3 text-left">Type</th>
              <th class="py-1 pr-3 text-right">Sett / Total</th>
              <th class="py-1 pr-3 text-right">Riktig</th>
              <th class="py-1 pr-3 text-right">Feil</th>
              <th class="py-1 text-right">Andel</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmap(stats) {
  const temaer = appData?.temaer || [];
  if (!temaer.length) return '';

  const headers = TYPES.map((t) =>
    `<th class="px-2 py-1 text-center text-xs font-medium opacity-70">${escapeHtml(t.label.replace('Multiple choice', 'MC'))}</th>`
  ).join('');

  const rows = temaer.map((tema) => {
    const row = stats.perTema[tema.id] || { perType: {} };
    const cells = TYPES.map((t) => {
      const c = row.perType?.[t.key] || { total: 0, riktig: 0, feil: 0 };
      const style = heatColor(c.riktig, c.feil);
      const sum = c.riktig + c.feil;
      const r = sum === 0 ? '—' : `${c.riktig}/${sum}`;
      return `<td class="px-1 py-1"><div class="px-2 py-1 rounded text-center text-xs font-semibold" style="${style}">${r}</div></td>`;
    }).join('');

    const sumRow = row.riktig + row.feil;
    const ratio = sumRow > 0 ? Math.round((row.riktig / sumRow) * 100) + '%' : '—';

    return `
      <tr class="border-t border-slate-200 dark:border-slate-700">
        <td class="py-1 pr-2 text-sm">${escapeHtml(tema.navn)}</td>
        ${cells}
        <td class="px-2 py-1 text-right text-xs font-semibold tabular-nums">${ratio}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-1">Heatmap: tema × oppgavetype</h2>
      <p class="text-xs opacity-60 mb-3">Riktig/sett innenfor hver kombinasjon. Grønt = sterk, rødt = svak.</p>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left">
              <th class="py-1 pr-2 text-xs uppercase opacity-60">Tema</th>
              ${headers}
              <th class="px-2 py-1 text-right text-xs uppercase opacity-60">Snitt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderWrongList(stats) {
  if (!stats.feilbesvarte.length) {
    return `
      <section class="card mt-4">
        <h2 class="text-lg font-semibold">Feilbesvarte spørsmål</h2>
        <p class="text-sm opacity-70 mt-2">Du har ingen feil registrert ennå. Sett i gang og øv! 💪</p>
      </section>
    `;
  }

  const items = stats.feilbesvarte.slice(0, 30).map(({ type, q, e }) => {
    const tema = findTema(q.tema);
    const text = q.front || q.sporsmal || q.tekst || q.tittel || q.id;
    return `
      <li class="border-t border-slate-200 dark:border-slate-700 py-2 first:border-0">
        <div class="flex items-center gap-2 flex-wrap text-xs opacity-70 mb-0.5">
          <span class="font-semibold">${escapeHtml(type.label)}</span>
          <span>·</span>
          <span>${escapeHtml(tema)}</span>
          ${q.vanskegrad ? `<span>·</span><span class="diff-pill diff-${escapeHtml(q.vanskegrad)}">${escapeHtml(q.vanskegrad)}</span>` : ''}
        </div>
        <a href="${type.route}" class="text-sm hover:underline">${escapeHtml(String(text).slice(0, 140))}${String(text).length > 140 ? '…' : ''}</a>
      </li>
    `;
  }).join('');

  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-1">Feilbesvarte spørsmål</h2>
      <p class="text-xs opacity-60 mb-2">Sist svar var feil. Klikk for å gå til modulen og øve på nytt.</p>
      <ul class="text-sm">${items}</ul>
      ${stats.feilbesvarte.length > 30 ? `<p class="text-xs opacity-60 mt-2">Viser 30 av ${stats.feilbesvarte.length} feilbesvarte.</p>` : ''}
    </section>
  `;
}

function renderExamHistory() {
  const hist = storage.get('eksamen.history', []) || [];
  if (!hist.length) return '';
  const items = hist.slice(0, 10).map((h) => {
    const dt = new Date(h.finishedAt).toLocaleString('no-NO');
    return `
      <li class="flex items-center justify-between gap-3 text-sm border-t border-slate-200 dark:border-slate-700 py-2 first:border-0">
        <span>${escapeHtml(dt)}</span>
        <span class="font-semibold">${h.score}/${h.total}</span>
        <span class="text-xs opacity-60">${h.pct}% · ${h.varighetMin} min</span>
      </li>
    `;
  }).join('');
  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-2">Eksamenforsøk</h2>
      <ul>${items}</ul>
    </section>
  `;
}

export function render(container, appState) {
  rootEl = container;
  appData = appState?.data || null;

  if (!appData) {
    rootEl.innerHTML = `
      <section class="card">
        <h1 class="text-2xl font-bold">Analyse</h1>
        <p class="opacity-70 mt-2">Laster pensumdata…</p>
      </section>
    `;
    return;
  }

  const stats = aggregate();

  rootEl.innerHTML =
    renderTotals(stats) +
    renderPerType(stats) +
    renderHeatmap(stats) +
    renderExamHistory() +
    renderWrongList(stats);
}
