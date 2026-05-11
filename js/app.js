// Hovedlogikk: hash-routing, datalasting, sidebar-state og tema-toggle.
import * as storage from './storage.js';
import { render as renderFlashcards } from './flashcards.js';
import { render as renderMultipleChoice } from './multiplechoice.js';
import { render as renderInnskriving } from './innskriving.js';
import { render as renderLangsvar } from './langsvar.js';
import { render as renderMatching } from './matching.js';
import { render as renderRegneoppgaver } from './regneoppgaver.js';
import { render as renderEksamen } from './eksamen.js';
import { render as renderAnalyse } from './analyse.js';
import { render as renderKildebank } from './kildebank.js';

const DEFAULT_ROUTE = 'dashboard';

const routes = {
  dashboard: renderDashboard,
  flashcards: renderFlashcards,
  multiplechoice: renderMultipleChoice,
  innskriving: renderInnskriving,
  langsvar: renderLangsvar,
  matching: renderMatching,
  regneoppgaver: renderRegneoppgaver,
  eksamen: renderEksamen,
  analyse: renderAnalyse,
  kildebank: renderKildebank,
};

const state = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  data: null,
  error: null,
};

// --- Data ---
async function loadData() {
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    state.data = json;
    state.status = 'ready';
  } catch (e) {
    state.error = e;
    state.status = 'error';
    console.error('Klarte ikke å laste data.json:', e);
  }
}

function count(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = target - today;
  return Math.round(ms / 86400000);
}

// --- Routing ---
function getCurrentRoute() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  return routes[raw] ? raw : DEFAULT_ROUTE;
}

function navigate() {
  const route = getCurrentRoute();
  const container = document.getElementById('app');
  if (!container) return;

  try {
    routes[route](container, state);
  } catch (e) {
    container.innerHTML = `
      <section class="card">
        <h1 class="text-2xl font-bold mb-2">Noe gikk galt</h1>
        <p class="opacity-80">Klarte ikke å laste ${route}-siden. Sjekk konsollen for detaljer.</p>
      </section>
    `;
    console.error('Render-feil for rute', route, e);
  }

  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  closeSidebarOnMobile();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// --- Dashboard ---
function renderDashboard(container, s) {
  if (s.status === 'loading') {
    container.innerHTML = `
      <section class="card">
        <h1 class="text-2xl md:text-3xl font-bold mb-2">Dashbord</h1>
        <p class="opacity-80">Laster pensumdata…</p>
      </section>
    `;
    return;
  }

  if (s.status === 'error') {
    container.innerHTML = `
      <section class="card">
        <h1 class="text-2xl md:text-3xl font-bold mb-2">Dashbord</h1>
        <div class="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200">
          <p class="font-semibold">Klarte ikke å laste data.json</p>
          <p class="text-sm mt-1">${escapeHtml(String(s.error || 'Ukjent feil'))}</p>
          <p class="text-sm mt-2 opacity-80">
            Tips: Åpne siden via en lokal server (f.eks. <code>python3 -m http.server 8000</code>),
            ikke ved å dobbeltklikke filen — <code>fetch()</code> blir blokkert på <code>file://</code>.
          </p>
        </div>
      </section>
    `;
    return;
  }

  const d = s.data || {};
  const meta = d.meta || {};
  const dager = daysUntil(meta.examDate);
  const antall = {
    flashcards: count(d.flashcards),
    multiplechoice: count(d.multiplechoice),
    innskriving: count(d.innskriving),
    langsvar: count(d.langsvar),
    matching: count(d.matching),
    regneoppgaver: count(d.regneoppgaver),
    eksamen: count(d.eksamen),
  };
  const totalt = Object.values(antall).reduce((a, b) => a + b, 0);

  container.innerHTML = `
    <section class="card">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold mb-1">Dashbord</h1>
          <p class="opacity-80 text-sm">
            ${escapeHtml(meta.course || 'TS200416')}
            ${meta.institution ? ' · ' + escapeHtml(meta.institution) : ''}
          </p>
        </div>
        <div class="text-right">
          <p class="text-xs opacity-60">Eksamen</p>
          <p class="font-semibold">${escapeHtml(meta.examDate || 'ukjent')}</p>
          ${
            dager !== null
              ? `<p class="text-xs opacity-70">${
                  dager > 0 ? `${dager} dager igjen` : dager === 0 ? 'I dag!' : `${Math.abs(dager)} dager siden`
                }</p>`
              : ''
          }
        </div>
      </div>
    </section>

    <section class="card mt-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success/20 text-success">✓</span>
        <h2 class="text-lg font-semibold">Data lastet</h2>
        <span class="text-xs opacity-60">v${escapeHtml(meta.version || '?')}</span>
      </div>
      <p class="opacity-80 text-sm mb-4">
        ${totalt} elementer totalt fordelt på ${count(d.temaer)} temaer.
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${statTile('Flashcards', antall.flashcards, '#/flashcards')}
        ${statTile('Multiple choice', antall.multiplechoice, '#/multiplechoice')}
        ${statTile('Innskriving', antall.innskriving, '#/innskriving')}
        ${statTile('Langsvar', antall.langsvar, '#/langsvar')}
        ${statTile('Matching', antall.matching, '#/matching')}
        ${statTile('Regneoppgaver', antall.regneoppgaver, '#/regneoppgaver')}
      </div>
      <p class="mt-6 text-sm opacity-60">
        <span class="placeholder-pill mr-2">Steg 2</span>
        data.json er hentet med fetch og cachet i app-state. Statistikk og karaktersimulator
        bygges på toppen i senere steg.
      </p>
    </section>
  `;
}

function statTile(label, n, href) {
  return `
    <a href="${href}"
       class="block px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
      <span class="block text-2xl font-bold leading-tight">${n}</span>
      <span class="block text-xs opacity-70">${escapeHtml(label)}</span>
    </a>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// --- Sidebar (mobil) ---
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const btn = document.getElementById('menuBtn');
  sidebar?.classList.remove('-translate-x-full');
  backdrop?.classList.remove('hidden');
  btn?.setAttribute('aria-expanded', 'true');
}
function closeSidebarOnMobile() {
  if (window.matchMedia('(min-width: 768px)').matches) return;
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const btn = document.getElementById('menuBtn');
  sidebar?.classList.add('-translate-x-full');
  backdrop?.classList.add('hidden');
  btn?.setAttribute('aria-expanded', 'false');
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar?.classList.contains('-translate-x-full')) openSidebar();
  else closeSidebarOnMobile();
}

// --- Tema ---
function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  storage.set('theme', next);
}

// --- Reset ---
function resetData() {
  const ok = confirm('Nullstille all progresjon og innstillinger? Dette kan ikke angres.');
  if (!ok) return;
  storage.clearAll();
  location.reload();
}

// --- Init ---
async function init() {
  if (!location.hash) {
    location.hash = '#/' + DEFAULT_ROUTE;
  }

  // Render straks (med loading-state) så UI svarer raskt.
  navigate();

  document.getElementById('menuBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('backdrop')?.addEventListener('click', closeSidebarOnMobile);
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('resetBtn')?.addEventListener('click', resetData);
  window.addEventListener('hashchange', navigate);

  await loadData();

  // Re-render gjeldende rute med ferdiglastet data
  navigate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
