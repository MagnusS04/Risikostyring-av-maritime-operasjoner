# SPEC.md – TS200416 Eksamensøving

## Formål
Bygg en statisk nettside (kun HTML/CSS/JS, ingen backend) som hjelper Magnus og medstudenter å øve til eksamen i **TS200416 Risikostyring av maritime operasjoner** (NTNU, 28. mai 2026). Siden skal hostes gratis på **GitHub Pages** og være tilgjengelig på en delbar URL.

## Designreferanse
Strukturen og følelsen skal være som https://martinbirkelund05-cell.github.io/SKID2210--Gutta/ – ren, fokusert, sidebar-navigasjon, dashboard som landingsside.

## Teknologivalg (viktig!)
- **Ren HTML + Vanilla JavaScript + Tailwind via CDN.** IKKE Next.js, IKKE React-build. Grunnen: GitHub Pages serverer kun statiske filer, og vanilla JS fjerner bygge-trinn helt. Alt skal funke ved å bare åpne `index.html` lokalt.
- **All data lagres i `localStorage`** (fremgang, statistikk, innstillinger). Ingen backend.
- **Innholdet ligger i `data.json`** som lastes ved oppstart med `fetch()`.
- **Mobilvennlig** (Magnus skal kunne pugge på bussen).
- **Mørkt og lyst tema** (toggle-knapp).

## Filstruktur
```
/
├── index.html              # Hovedfil – inneholder hele app-shell
├── css/
│   └── style.css           # Custom CSS som supplerer Tailwind
├── js/
│   ├── app.js              # Hovedlogikk + ruter
│   ├── storage.js          # localStorage-wrapper
│   ├── flashcards.js       # Flashcard-modul
│   ├── multiplechoice.js   # MC-modul
│   ├── innskriving.js      # Innskrivingsmodul
│   ├── matching.js         # Matching-modul
│   ├── regneoppgaver.js    # Regneoppgavemodul
│   ├── eksamen.js          # Full eksamensprøve
│   ├── analyse.js          # Statistikk/dashboard
│   └── kildebank.js        # Pensumoversikt
├── data.json               # Hovedinnhold (alle spørsmål + temaer)
└── README.md               # Hvordan kjøre lokalt + deploy til GitHub Pages
```

## Sider (ruter via hash-routing, f.eks. `#/flashcards`)

### 1. `#/dashboard` (landingsside)
- Velkomst med kandidatnavn (fra localStorage, settes ved første besøk)
- **Statistikk-kort:** Total fremgang, antall spørsmål besvart, gjennomsnittsskår, dager til eksamen (28. mai 2026)
- **Karaktersimulator:** Basert på siste 50 svar – estimert karakter (A-F, samme grenser som SKID2210)
- **Hurtigtilgang:** Stort knapper til hver modul
- **Tema-fordeling:** Lite stolpediagram som viser hvordan du presterer per tema

### 2. `#/flashcards`
- Klassiske snu-kort: spørsmål foran, svar bak
- Velg tema (eller "alle")
- "Kunne den"/"Må øve mer"-knapper – bygger en personlig "vanskelige kort"-bunke
- Spaced repetition lite: kort som ble feil dukker opp oftere

### 3. `#/multiplechoice`
- Spørsmål med 4 alternativer, ett riktig
- Umiddelbar tilbakemelding + **forklaring** (viktig!)
- Filtrer på tema og vanskegrad
- "Bare nye spørsmål"-modus

### 4. `#/innskriving`
- Skriv svaret i tekstfelt
- Aksepter flere riktige formuleringer (alternative svar i datasettet)
- Vis riktig svar etter forsøk + forklaring

### 5. `#/matching`
- Mange kort vises samtidig – dra/klikk for å matche begrep med definisjon
- Brukes f.eks. til ISO-standarder, modeller (Bow tie, Swiss cheese, MTO osv.)

### 6. `#/regneoppgaver`
- Tekstoppgave med tall som skal regnes ut
- Tekstfelt for svar (numerisk, med toleranse, f.eks. ±0.01)
- Vis full løsning steg-for-steg etter innsending
- Kategorier: Pålitelighet, MTBF, Sannsynlighet, Systempålitelighet

### 7. `#/eksamen`
- Simulert eksamen: 3 oppgaver (lik strukturen på TS200416-eksamener)
- Tidtaking: 3 timer (slik som ekte eksamen)
- Lagrer svar lokalt
- Selvevaluering etter levering (siden mange spørsmål er langsvar)

### 8. `#/analyse`
- Detaljert statistikk: per tema, per oppgavetype, over tid
- Heatmap over hvilke temaer du sliter med
- Liste over feilbesvarte spørsmål (kan øve på nytt)

### 9. `#/kildebank`
- Oversikt over alle pensumkilder (forelesninger, læreboka, ISO-standarder)
- Lenker til relevante temaer
- "Hvor i pensum?" for hvert spørsmål

## Datastruktur for `data.json`

```json
{
  "meta": {
    "course": "TS200416 Risikostyring av maritime operasjoner",
    "institution": "NTNU",
    "examDate": "2026-05-28",
    "version": "1.0.0"
  },
  "temaer": [
    { "id": "risiko-grunnlag", "navn": "Risikobegreper og grunnlag", "kilder": ["dag1", "dag2", "kap6", "kap7"] },
    { "id": "iso-31000", "navn": "ISO 31000 og risikostyringsprosessen", "kilder": ["dag2", "dag3"] },
    { "id": "risikoidentifisering", "navn": "Risikoidentifisering (HAZID, grov analyse)", "kilder": ["dag3"] },
    { "id": "palitelighet", "navn": "Pålitelighet og blokkdiagram", "kilder": ["dag3", "dag4"] },
    { "id": "barrierer", "navn": "Barrierer og ulykkesmodeller", "kilder": ["dag4", "dag5"] },
    { "id": "organisasjon", "navn": "Organisasjon, NAT, HRO, MTO", "kilder": ["dag5"] },
    { "id": "beslutninger", "navn": "Beslutninger, heuristikker, ELECTRE", "kilder": ["dag6"] },
    { "id": "indikatorer", "navn": "Sikkerhetsindikatorer og rapportering", "kilder": ["dag7", "kap9", "kap10"] }
  ],
  "flashcards": [
    {
      "id": "fc-001",
      "tema": "risiko-grunnlag",
      "vanskegrad": "lett",
      "front": "Hvilke to grunnelementer består risiko av (ifølge kursets definisjon)?",
      "back": "Sannsynlighet (eller frekvens) og konsekvens. Risiko = sannsynlighet × konsekvens.",
      "kilde": "dag1 s.17"
    }
  ],
  "multiplechoice": [
    {
      "id": "mc-001",
      "tema": "iso-31000",
      "vanskegrad": "middels",
      "sporsmal": "Hvilke tre hovedaktiviteter inngår i risikovurdering ifølge ISO 31000?",
      "alternativer": [
        "Identifisering, analyse, evaluering",
        "Planlegging, gjennomføring, evaluering",
        "Kommunikasjon, analyse, behandling",
        "Identifisering, behandling, overvåking"
      ],
      "rett": 0,
      "forklaring": "Risikovurdering består av risikoidentifisering, risikoanalyse og risikoevaluering. Risikohåndtering er et eget steg, ikke en del av risikovurderingen.",
      "kilde": "dag2 s.8"
    }
  ],
  "innskriving": [
    {
      "id": "in-001",
      "tema": "palitelighet",
      "sporsmal": "Hva står forkortelsen MTBF for?",
      "godkjenteSvar": ["Mean Time Between Failures", "mean time between failures", "MTBF"],
      "forklaring": "MTBF = Mean Time Between Failures. Beregnes som totalt antall driftstimer / antall feil.",
      "kilde": "dag1 s.24"
    }
  ],
  "matching": [
    {
      "id": "ma-001",
      "tema": "barrierer",
      "tittel": "Match modell med beskrivelse",
      "par": [
        { "venstre": "Bow tie", "hoyre": "Modell som deler barrierer i forhindrende og begrensende" },
        { "venstre": "Swiss cheese (Reason)", "hoyre": "Viser hvordan barrierer bryter sammen via latente og aktive feil" },
        { "venstre": "Haddon", "hoyre": "Prinsipper for å finne barrierer mot ulykker" },
        { "venstre": "MTO", "hoyre": "Systemperspektiv: Menneske–Teknologi–Organisasjon" }
      ]
    }
  ],
  "regneoppgaver": [
    {
      "id": "re-001",
      "tema": "palitelighet",
      "tekst": "En dieselgenerator har MTBF = 5000 timer. Hva er sannsynligheten (i %) for at den svikter i en gitt driftstime, gitt forenklingen P = 1 - 1/MTBF?",
      "svar": 0.02,
      "enhet": "%",
      "toleranse": 0.005,
      "losning": "Sviktintensitet λ = 1/MTBF = 1/5000 = 0,0002 per time = 0,02 %.",
      "kilde": "dag1 s.24"
    }
  ],
  "eksamen": [
    {
      "id": "eks-2024",
      "navn": "Eksamen vår 2024 (full)",
      "varighet": 180,
      "oppgaver": [ "..." ]
    }
  ]
}
```

## Designdetaljer

### Farger (brukes som CSS-variabler, støtter dark/light)
```css
--primary: #1d4ed8       /* NTNU-blå */
--accent: #f59e0b        /* aksent for korrekt/varsel */
--success: #16a34a
--danger: #dc2626
--bg: #ffffff (light) / #0f172a (dark)
--surface: #f1f5f9 / #1e293b
--text: #0f172a / #f1f5f9
```

### Typografi
- Sans-serif: system-ui (`-apple-system, BlinkMacSystemFont, ...`)
- Headings: bold
- Quiz-tekst: 16-18px for god lesbarhet

### Komponenter (gjennomgående)
- **Sidebar (venstre):** alltid synlig på desktop, hamburgermeny på mobil. Lenker til dashbord, øvingstyper, eksamen, analyse, kildebank. Nederst: tema-toggle + nullstill-data.
- **Hovedinnholdsområde (høyre):** padded kort (rounded-xl, shadow-sm), maks-bredde ca 800px, sentrert.
- **Knapper:** Tailwind-style, rounded-lg, hover-effekter, tydelig hovedhandling.
- **Progressindikator:** prosentlinje øverst i hver øvingsmodul.

## Krav til kvalitet

1. **Responsiv:** Må funke fint på mobil (320px+) og desktop.
2. **Tilgjengelighet:** Tastaturnavigerbar, riktig kontrast, semantisk HTML.
3. **Ytelse:** Lader på under 2 sekunder. data.json kan være opp til ~500KB uten problem.
4. **Robusthet:** Hvis data.json mangler felt, ikke krasj – håndter elegant.
5. **Lagring:** All progresjon overlever side-refresh (localStorage).
6. **Reset:** Bruker kan nullstille all data fra et sted.

## Hva GitHub Pages krever

- Filene må ligge i repo-roten (eller `/docs`)
- En `.nojekyll`-fil i roten (tom) – så GitHub ikke prosesserer som Jekyll
- `index.html` må være entrypoint
- Alle paths må være **relative** (ikke `/css/style.css`, men `css/style.css` eller `./css/style.css`)

## Akseptansekriterier (sjekkliste)

- [ ] `index.html` åpner direkte i nettleser uten build-steg
- [ ] Alle 9 sider/ruter funker
- [ ] Flashcards: kan flippe, navigere fremover/bakover, merke vanskelig
- [ ] MC: viser feil/riktig + forklaring etter svar
- [ ] Innskriving: aksepterer alternative formuleringer
- [ ] Matching: dra-og-slipp eller klikk-for-å-matche
- [ ] Regneoppgaver: numerisk svar med toleranse
- [ ] Eksamen: tidtaker funker
- [ ] Statistikk persisteres mellom besøk
- [ ] Mørk/lys-modus funker
- [ ] Mobilvennlig (sjekk på 375px viewport)
- [ ] Deploy: `git push` → tilgjengelig på `magnuss04.github.io/[reponavn]/`

## Bygg-rekkefølge for Claude Code (følg denne!)

1. **Først:** Lag filstruktur + tom index.html med sidebar og routing-skjelett. Verifiser at sidebar funker og hash-routing bytter sider.
2. **Så:** Last data.json og vis "ferdig lastet"-melding på dashboard. Verifiser at fetch fungerer.
3. **Så:** Implementer flashcards-modulen komplett. Test med startsett.
4. **Så:** Multiple choice. Test.
5. **Så:** Innskriving. Test.
6. **Så:** Matching. Test.
7. **Så:** Regneoppgaver. Test.
8. **Så:** Eksamen-modus. Test tidtaker.
9. **Så:** Analyse/statistikk-side.
10. **Så:** Kildebank.
11. **Til slutt:** Polering, dark mode, mobile fixes.

**VIKTIG:** Test hver modul fungerer før du går videre til neste. Ikke bygg alt på én gang.
