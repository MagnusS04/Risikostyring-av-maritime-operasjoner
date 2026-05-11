// Kildebank: oversikt over alle pensumkilder, hvilke temaer de dekker,
// og hvilke spørsmål som refererer hver kilde.

const FORELESNINGER = [
  { id: 'dag1', navn: 'Undervisning dag 1', fil: 'Undervisning dag 1.pdf', stikk: 'Risikobegreper, MTBF, sviktintensitet, badekarkurve' },
  { id: 'dag2', navn: 'Undervisning dag 2', fil: 'Undervisning dag 2.pdf', stikk: 'ISO 31000, risikohåndtering i praksis' },
  { id: 'dag3', navn: 'Undervisning dag 3', fil: 'Undervisning dag 3.pdf', stikk: 'Risikoidentifisering, pålitelighetsblokkdiagram, sti/kutt' },
  { id: 'dag4', navn: 'Undervisning dag 4', fil: 'Undervisning dag4.pdf', stikk: 'Barrierer (ulykkesteori, energi/barriere)' },
  { id: 'dag5', navn: 'Undervisning dag 5', fil: 'Undervisning dag 5.pdf', stikk: 'NAT, HRO, MMD, MTO, Reason' },
  { id: 'dag6', navn: 'Undervisning dag 6', fil: 'Undervisning dag 6.pdf', stikk: 'Beslutninger, heuristikker, ELECTRE' },
  { id: 'dag7', navn: 'Undervisning dag 7', fil: 'Undervisning dag 7.pdf', stikk: 'Sikkerhetsindikatorer, rapportering' },
  { id: 'repetisjon', navn: 'Repetisjon', fil: 'repetisjon.pdf', stikk: 'Oppsummering hele faget' },
];

const EKSAMENER = [
  { id: 'eks-v23', navn: 'Eksamen vår 2023', fil: 'Eksamen Vår 2023.pdf' },
  { id: 'eks-v23-l1', navn: 'Løsningsforslag oppgave 1 (V23)', fil: 'Løsningsforslag oppg 1.pdf' },
  { id: 'eks-v23-l2', navn: 'Løsningsforslag oppgave 2 (V23)', fil: 'løsningsforslag oppgave 2.pdf' },
  { id: 'eks-v24', navn: 'Eksamen vår 2024 (bokmål)', fil: 'Eksamen V24_bokmål(1).pdf' },
  { id: 'eks-v24-l', navn: 'Løsningsforslag eksamen vår 2024', fil: 'løsningsforslag eksamen vår 24 (4)(1).docx' },
  { id: 'eks-v25', navn: 'Eksamen 2025', fil: 'eksamen 2025.pdf' },
];

const OPPGAVER = [
  { id: 'mappe-dag1', navn: 'Oppgaver Mappe dag 1', fil: 'Oppgaver Mappe dag1.pdf', stikk: 'Pålitelighetsoppgaver' },
  { id: 'opp-beslutning', navn: 'Oppgave: Beslutninger', fil: 'Oppgave beslutninger.pdf' },
  { id: 'opp-vikingsky', navn: 'Oppgave dag 3 – Viking Sky', fil: 'oppgave dag 3 viking sky.pdf', stikk: 'Case Viking Sky' },
  { id: 'case-salmar', navn: 'Case SalMar–NTNU', fil: 'Case - SalMarNTNU - 20.04.2026.pdf' },
  { id: 'helge-ingstad', navn: 'Sammendragsrapport KNM Helge Ingstad', fil: '2019-08 Sammendragsrapport_Helge Ingstad.pdf' },
  { id: 'arbeidskrav', navn: 'Oppgave til arbeidskrav', fil: 'Oppgave til arbeidskrav.docx' },
  { id: 'lf-arbeid', navn: 'Løsningsforslag arbeidskrav', fil: 'Løsningsforslag.docx', stikk: 'Pålitelighet, ELECTRE, barrierer' },
];

const TILLEGG = [
  { id: 'electre', navn: 'Rangeringsmetoder – ELECTRE', fil: 'Rangeringsmetoder_ELECTRE.pdf' },
  { id: 'pbd', navn: 'Pålitelighetsblokkdiagram', fil: 'Pålitelighetsblokkdiagram.pdf' },
  { id: 'syspal', navn: 'Systempålitelighet', fil: 'Systempålitelighet.pdf' },
  { id: 'mal-rv', navn: 'Risikovurdering – MAL', fil: 'Risikovurdering MAL.xlsx' },
  { id: 'palexcel', navn: 'Pålitelighet – regneeksempler', fil: 'pålitelighet.xlsx' },
];

const ALL_SOURCES = [
  ...FORELESNINGER,
  ...EKSAMENER,
  ...OPPGAVER,
  ...TILLEGG,
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fileHref(fil) {
  // Behold skråstrek, men URL-encode mellomrom og spesialtegn
  return 'Pensum/' + encodeURI(fil);
}

function fileExt(fil) {
  const i = fil.lastIndexOf('.');
  return i === -1 ? '' : fil.slice(i + 1).toLowerCase();
}

function extBadge(ext) {
  const m = {
    pdf:  ['PDF',  'background:#fee2e2;color:#991b1b'],
    docx: ['DOCX', 'background:#dbeafe;color:#1e40af'],
    xlsx: ['XLSX', 'background:#dcfce7;color:#166534'],
  };
  const [label, style] = m[ext] || [ext.toUpperCase() || 'FIL', 'background:#e2e8f0;color:#334155'];
  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="${style}">${label}</span>`;
}

function findSourceById(id) {
  return ALL_SOURCES.find((s) => s.id === id) || null;
}

// Mapper en kilde-id (slik den står i temaer.kilder[]) til fil/navn.
function knownSource(key) {
  const exact = findSourceById(key);
  if (exact) return exact;
  // Fallback: ukjent kilde-key (f.eks. "Aven kap.6") → bare vis som tekst
  return { id: key, navn: key, fil: null };
}

// Samler alle spørsmål med deres "kilde"-felt på tvers av oppgavetyper.
function collectKildeStrings(data) {
  const out = [];
  const types = [
    { key: 'flashcards', label: 'Flashcard' },
    { key: 'multiplechoice', label: 'MC' },
    { key: 'innskriving', label: 'Innskriving' },
    { key: 'langsvar', label: 'Langsvar' },
    { key: 'matching', label: 'Matching' },
    { key: 'regneoppgaver', label: 'Regneoppgave' },
  ];
  for (const t of types) {
    for (const q of (data?.[t.key] || [])) {
      if (q.kilde) out.push({ type: t, q, kilde: q.kilde });
    }
  }
  return out;
}

function groupByKilde(items) {
  const groups = {};
  for (const it of items) {
    const k = it.kilde.trim();
    if (!groups[k]) groups[k] = [];
    groups[k].push(it);
  }
  // Sortér på antall spørsmål synkende
  return Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length);
}

function findTema(data, id) {
  const t = (data?.temaer || []).find((x) => x.id === id);
  return t?.navn || id;
}

// --- Render ---

function renderSourceCard(s) {
  const ext = s.fil ? fileExt(s.fil) : null;
  const badge = ext ? extBadge(ext) : '';
  const link = s.fil
    ? `<a href="${escapeHtml(fileHref(s.fil))}" target="_blank" rel="noopener" class="hover:underline">${escapeHtml(s.navn)}</a>`
    : `<span>${escapeHtml(s.navn)}</span>`;
  return `
    <li class="flex items-start gap-2 py-1.5">
      ${badge}
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${link}</div>
        ${s.stikk ? `<div class="text-xs opacity-60">${escapeHtml(s.stikk)}</div>` : ''}
      </div>
    </li>
  `;
}

function renderGroup(title, sources) {
  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-2">${escapeHtml(title)}</h2>
      <ul class="divide-y divide-slate-200 dark:divide-slate-700">
        ${sources.map(renderSourceCard).join('')}
      </ul>
    </section>
  `;
}

function renderPerTema(data) {
  const temaer = data?.temaer || [];
  if (!temaer.length) return '';
  const items = temaer.map((t) => {
    const kilder = (t.kilder || []).map((k) => {
      const src = knownSource(k);
      if (src.fil) {
        return `<a href="${escapeHtml(fileHref(src.fil))}" target="_blank" rel="noopener" class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">${escapeHtml(src.navn)}</a>`;
      }
      return `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 opacity-80">${escapeHtml(src.navn)}</span>`;
    }).join(' ');
    return `
      <div class="border-t border-slate-200 dark:border-slate-700 py-3 first:border-0">
        <div class="font-medium">${escapeHtml(t.navn)}</div>
        ${t.beskrivelse ? `<p class="text-xs opacity-70 mt-0.5">${escapeHtml(t.beskrivelse)}</p>` : ''}
        <div class="mt-2 flex flex-wrap gap-1">${kilder || '<span class="text-xs opacity-60">Ingen kilder registrert</span>'}</div>
      </div>
    `;
  }).join('');
  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-2">Per tema</h2>
      <p class="text-xs opacity-60 mb-2">Kilder som dekker hvert tema, fra <code>data.json</code>.</p>
      ${items}
    </section>
  `;
}

function renderQuestionsByKilde(data) {
  const items = collectKildeStrings(data);
  const groups = groupByKilde(items);
  if (!groups.length) {
    return `
      <section class="card mt-4">
        <h2 class="text-lg font-semibold mb-2">Spørsmål per kilde</h2>
        <p class="text-sm opacity-70">Ingen spørsmål har "kilde"-felt enda.</p>
      </section>
    `;
  }

  const blocks = groups.map(([kilde, list]) => {
    const lines = list.slice(0, 10).map(({ type, q }) => {
      const text = q.front || q.sporsmal || q.tekst || q.tittel || q.id;
      return `
        <li class="text-sm py-1 border-t border-slate-200 dark:border-slate-700 first:border-0">
          <span class="text-xs uppercase opacity-60 mr-1">${escapeHtml(type.label)}</span>
          ${escapeHtml(String(text).slice(0, 130))}${String(text).length > 130 ? '…' : ''}
          <span class="text-xs opacity-50 ml-1">· ${escapeHtml(findTema(data, q.tema))}</span>
        </li>
      `;
    }).join('');
    const more = list.length > 10 ? `<li class="text-xs opacity-60 pt-1">… og ${list.length - 10} til</li>` : '';
    return `
      <details class="border-t border-slate-200 dark:border-slate-700 first:border-0 py-2">
        <summary class="cursor-pointer flex items-center gap-2">
          <span class="font-medium">${escapeHtml(kilde)}</span>
          <span class="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">${list.length}</span>
        </summary>
        <ul class="mt-1 pl-1">${lines}${more}</ul>
      </details>
    `;
  }).join('');

  return `
    <section class="card mt-4">
      <h2 class="text-lg font-semibold mb-1">Spørsmål per kilde</h2>
      <p class="text-xs opacity-60 mb-2">Klikk på en kilde for å se hvilke spørsmål som refererer den.</p>
      ${blocks}
    </section>
  `;
}

function renderHeader() {
  return `
    <section class="card">
      <h1 class="text-2xl font-bold">Kildebank</h1>
      <p class="text-sm opacity-70 mt-1">
        Alle pensumkilder samlet på ett sted. Klikk en kilde for å åpne PDF/dokumentet i ny fane.
      </p>
    </section>
  `;
}

export function render(container, appState) {
  const data = appState?.data || null;
  container.innerHTML =
    renderHeader() +
    renderGroup('Forelesninger', FORELESNINGER) +
    renderGroup('Eksamener', EKSAMENER) +
    renderGroup('Oppgaver og caser', OPPGAVER) +
    renderGroup('Tilleggsmateriale', TILLEGG) +
    renderPerTema(data) +
    renderQuestionsByKilde(data);
}
