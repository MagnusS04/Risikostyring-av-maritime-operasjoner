# 🚀 START HER – TS200416 Quiz-prosjekt

Hei Magnus! Dette dokumentet forteller deg **steg-for-steg** hva du skal gjøre videre. Følg det i rekkefølge.

## Filer du har fått

1. **`SPEC.md`** – Komplett byggespec for nettsiden. Gi denne til Claude Code.
2. **`CONTENT_GUIDE.md`** – Forklarer hvordan Claude Code skal lese pensum og lage flere spørsmål.
3. **`data.json`** – Startsett med ~30 spørsmål (flashcards, MC, innskriving, matching, regneoppgaver) basert på pensum.
4. **`START_HER.md`** – Denne filen.

## Steg 1: Legg filene i prosjektmappen

Du har allerede en mappe lokalt (`Risikostyring av maritime operasjoner`) som er koblet til GitHub-repoet ditt og Claude Code. Legg disse fire filene i roten av den mappen.

**Tips:** Hvis det er gamle filer fra forrige forsøk i mappen, ryd opp først! Slett `package.json`, `node_modules/`, `src/`, eller andre ting som lå der fra Cursor-forsøket. La pensum-PDF-ene ligge.

## Steg 2: Åpne Claude Code i prosjektmappen

Du har allerede Claude Code åpent på Risikostyring-mappen. Bra.

## Steg 3: Send denne *eksakte* prompten til Claude Code

Kopier alt mellom de to streklinjene og lim inn:

---

```
Hei! Vi skal bygge en eksamensøvingsside for emnet TS200416 Risikostyring 
av maritime operasjoner. Eksamen er 28. mai 2026.

Les disse tre filene FØRST i denne rekkefølgen:
1. START_HER.md (denne filen ligger forklart kontekst i)
2. SPEC.md (komplett byggespec)
3. CONTENT_GUIDE.md (innhold-utvidelse senere)

Følg byggrekkefølgen som er beskrevet nederst i SPEC.md – ikke bygg alt 
på en gang. Test hver modul lokalt etter at den er ferdig.

VIKTIG:
- Ren HTML + Vanilla JS + Tailwind via CDN. IKKE Next.js, IKKE React-build.
- All data i data.json. All progresjon i localStorage.
- Alle paths må være relative (for GitHub Pages).
- Bruk filstrukturen i SPEC.md.

Pensum-PDF-ene ligger allerede i mappen. data.json har et startsett du 
kan bruke til å teste at alt funker. Senere skal du lese pensum-PDFene 
og utvide data.json (se CONTENT_GUIDE.md), men ikke gjør det nå – 
fokuser på å bygge nettsiden først.

Start med å lese de tre filene, så lag en kort plan på 5-7 punkter 
om hvordan du skal gå frem. Vent på godkjenning fra meg før du 
begynner å skrive kode.
```

---

## Steg 4: Test underveis

Hver gang Claude Code sier en modul er ferdig:

1. **Åpne `index.html` i nettleseren** (dobbeltklikk filen, eller bruk en lokal server – Claude Code kan starte en med `python3 -m http.server` eller `npx serve`)
2. **Test modulen manuelt** – flipp et flashcard, svar på en MC, osv.
3. **Si fra hvis noe ikke funker** – Claude Code fikser før dere går videre

## Steg 5: Når nettsiden funker lokalt – pusj til GitHub

Når alle moduler er ferdig og funker, be Claude Code:

```
Push alle endringer til GitHub. Bruk en god commit-melding.
```

## Steg 6: Aktiver GitHub Pages

1. Gå til ditt repo på github.com (`MagnusS04/Risikostyring-av-maritime-operasjoner`)
2. Klikk **Settings** (i repoet, ikke kontoen)
3. Venstremeny → **Pages**
4. Under "Source": velg **Deploy from a branch**
5. Branch: **main**, mappe: **/ (root)**
6. Klikk **Save**
7. Vent 1-2 minutter

Lenken din blir:
```
https://magnuss04.github.io/Risikostyring-av-maritime-operasjoner/
```

(Hvis du har koblet Vercel også, så vil Vercel publisere automatisk – det er greit, du har bare to lenker da. Du kan slette Vercel-prosjektet hvis du ønsker.)

## Steg 7: Del med medstudenter 🎉

Send lenken til kompiser.

## Steg 8: Utvid innholdet

Etter siden funker, kan du be Claude Code utvide data.json:

```
Les Eksamen Vår 2023 og lag 10 multiple choice-spørsmål basert på 
oppgavene. Følg formatet i CONTENT_GUIDE.md. Legg dem til i data.json.
```

```
Generer 20 nye flashcards om barrierer basert på Undervisning dag 4 
og dag 5. Følg formatet i CONTENT_GUIDE.md.
```

Hver gang du legger til innhold, push til GitHub, så oppdaterer 
nettsiden seg automatisk innen et par minutter.

---

## Hvis noe går galt

- **Hjemme i denne chatten med meg (Claude på claude.ai):** spør om hjelp med planlegging, design, innholdskvalitet, eller hvis Claude Code bygger noe rart.
- **Claude Code:** spør om alt teknisk – feilmeldinger, manglende filer, npm-problemer.

Lykke til! Du har et veldig godt utgangspunkt nå. 💪
