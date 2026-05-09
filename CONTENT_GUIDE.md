# CONTENT_GUIDE.md – Hvordan utvide data.json

Denne filen forklarer hvordan **Claude Code** skal lese pensum-PDF-er og generere flere spørsmål til `data.json` etter at nettsiden er bygget.

## Når dette brukes

Etter at den grunnleggende nettsiden er ferdig (alle moduler funker med startsettet), skal innholdet utvides. Magnus vil typisk be om:
- "Lag 20 nye flashcards om barrierer"
- "Generer multiple choice-spørsmål basert på Eksamen Vår 2024"
- "Legg til regneoppgaver fra Oppgaver Mappe dag 1"

## Pensumkilder (alle ligger i prosjektmappen)

### Forelesninger
- `Undervisning dag 1.pdf` → Risikobegreper, MTBF, sviktintensitet, badekarkurve
- `Undervisning dag 2.pdf` → ISO 31000, risikohåndtering i praksis
- `Undervisning dag 3.pdf` → Risikoidentifisering, pålitelighetsblokkdiagram, sti/kutt
- `Undervisning dag4.pdf` → Barrierer (ulykkesteori, energi/barriere)
- `Undervisning dag 5.pdf` → NAT, HRO, MMD, MTO, Reason
- `Undervisning dag 6.pdf` → Beslutninger, heuristikker, ELECTRE
- `Undervisning dag 7.pdf` → Sikkerhetsindikatorer, rapportering
- `repetisjon.pdf` → Oppsummering hele faget

### Eksamener (gull verdt for spørsmålsstil!)
- `Eksamen Vår 2023.pdf` + `Løsningsforslag oppg 1.pdf`, `løsningsforslag oppgave 2.pdf`
- `Eksamen V24 bokmål1.pdf` + `løsningsforslag eksamen vår 24 (4) (1).docx`
- `eksamen 2025.pdf`

### Oppgaver og caser
- `Oppgaver Mappe dag1.pdf` → Mappeoppgaver med pålitelighet
- `Oppgave beslutninger.pdf` → Beslutningsoppgaver
- `oppgave dag 3 viking sky.pdf` → Case Viking Sky
- `Case_SalMar_NTNU_20_04_2026.pdf` → Case SalMar
- `201908 Sammendragsrapport Helge Ingstad.pdf` → KNM Helge Ingstad-ulykken
- `Oppgave til arbeidskrav.docx` → Arbeidskravoppgaven
- `Løsningsforslag.docx` → Løsningsforslag (pålitelighet, ELECTRE, barrierer)

### Tilleggsmateriale
- `Rangeringsmetoder ELECTRE.pdf`
- `Pålitelighetsblokkdiagram.pdf`
- `Systempålitelighet.pdf`
- `Risikovurdering MAL.xlsx` → Mal for risikovurdering
- `pålitelighet.xlsx` → Regneeksempler

## Datastruktur (ALLTID følg denne)

Alle nye spørsmål må følge formatene i den eksisterende `data.json`. Kort oversikt:

### Flashcard
```json
{
  "id": "fc-XXX",
  "tema": "<en av temaeneId fra temaer-arrayet>",
  "vanskegrad": "lett" | "middels" | "vanskelig",
  "front": "Spørsmål her",
  "back": "Svar her – gjerne med kort forklaring",
  "kilde": "Forelesning X / Eksamen / kapittel"
}
```

### Multiple choice
```json
{
  "id": "mc-XXX",
  "tema": "...",
  "vanskegrad": "...",
  "sporsmal": "...",
  "alternativer": ["A", "B", "C", "D"],
  "rett": 0,    // INDEKS, ikke bokstav
  "forklaring": "Forklar hvorfor riktig er riktig OG hvorfor de andre er feil hvis det er pedagogisk verdt det.",
  "kilde": "..."
}
```

### Innskriving
```json
{
  "id": "in-XXX",
  "tema": "...",
  "sporsmal": "...",
  "godkjenteSvar": ["Hovedform", "alternativ form", "akronym", "med liten bokstav"],
  "forklaring": "...",
  "kilde": "..."
}
```
**Viktig:** Inkluder alltid både med stor og liten forbokstav, og akronym hvis det finnes.

### Matching
```json
{
  "id": "ma-XXX",
  "tema": "...",
  "tittel": "Match X med Y",
  "par": [
    { "venstre": "Begrep A", "hoyre": "Definisjon A" },
    { "venstre": "Begrep B", "hoyre": "Definisjon B" }
  ]
}
```
**Anbefaling:** 4–8 par per matching-oppgave er mest pedagogisk.

### Regneoppgave
```json
{
  "id": "re-XXX",
  "tema": "...",
  "tekst": "Oppgavetekst med tall",
  "svar": 0.96,             // numerisk
  "enhet": "%",             // tom streng hvis ingen
  "toleranse": 0.005,       // hvor mye kan svaret avvike
  "losning": "Steg-for-steg løsning",
  "kilde": "..."
}
```

## Kvalitetskrav til spørsmål

1. **Pensumtroskap:** Spørsmålene skal speile det faktiske pensumet. Ikke gjette på temaer som ikke er dekket.
2. **Bruk forelesers språk:** Hvis Bjarne kaller noe "sviktintensitet", ikke kall det "feilrate".
3. **Vanskegrad-balanse:** ~40% lett, ~40% middels, ~20% vanskelig.
4. **Forklaring er obligatorisk:** Hver MC skal ha forklaring som lærer noe – ikke bare "fordi alternativ A er riktig".
5. **Eksamenstro:** For MC, baser distraktorer (feilalternativer) på vanlige misforståelser fra pensum.
6. **Unngå dobbel-negasjoner og tvetydigheter** i spørsmålsformuleringer.
7. **Ikke duplikater:** Sjekk eksisterende spørsmål før du legger til. Variér formuleringene.

## Arbeidsflyt for Claude Code

Når Magnus ber om "lag X nye spørsmål om Y":

1. **Les relevante PDF-er** med PDF-leseren (skill: pdf-reading).
2. **Identifiser nøkkelpunkter** fra pensumet.
3. **Generer spørsmål** etter strukturen over.
4. **Tildel unik ID:** Tell eksisterende fc-XXX og fortsett (fc-021, fc-022, ...).
5. **Tildel riktig tema-ID** fra `temaer`-arrayet.
6. **Legg til i riktig array** i `data.json` – ikke overskriv eksisterende.
7. **Valider JSON** før lagring (ingen syntax-feil).
8. **Bump version** i `meta.version` (semver, patch-bump).
9. **Oppdater `lastUpdated`** i meta.

## Eksempel-prompts Magnus kan bruke i Claude Code

> "Les Eksamen Vår 2023 og generer 10 multiple choice-spørsmål basert på oppgavene der. Bruk eksamensspråket. Legg dem til i data.json."

> "Lag 15 flashcards om barrierer basert på Undervisning dag 4 og dag 5. Inkluder Bow tie, Swiss cheese, Haddon, og energi/barriere-modellen."

> "Generer 5 regneoppgaver om systempålitelighet med varierende vanskegrad, basert på Pålitelighetsblokkdiagram.pdf og Systempålitelighet.pdf."

> "Les case Viking Sky og lag en eksamensoppgave i samme stil som ekte eksamen, med delspørsmål a, b, c."

## Mål for fullt datasett (før eksamen 28. mai)

| Type | Mål-antall |
|------|------------|
| Flashcards | 100–150 |
| Multiple choice | 60–80 |
| Innskriving | 30–40 |
| Matching-sett | 8–12 |
| Regneoppgaver | 20–30 |
| Eksamenssett | 3 (basert på V23, V24, V25) |

## Tips: Skriv til data.json trygt

Bruk Python eller Node til å parse → endre → skrive (med pen JSON-formatering):
```python
import json
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
data['flashcards'].append({...})
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
```
Dette unngår feil med æ/ø/å og sikrer gyldig JSON.
