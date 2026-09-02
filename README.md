# Web Transparentní Vyškov

Volební web sdružení nezávislých kandidátů do zastupitelstva města Vyškova.
Volby jsou **9.–10. října 2026**.

Web je statický — žádný server, žádná databáze, žádné cookies ani měřicí kódy.

---

## Co kde je

| Složka | Co obsahuje |
|---|---|
| `src/content/kandidati/` | **Kandidáti** — jeden soubor na člověka, tady se vyplňují medailonky |
| `src/content/program/` | **Program** — osm oblastí, odrážky na stránce `/program/` |
| `src/content/program-detail/` | **Podrobný program** — to, co bylo na starém webu za tlačítkem „Chci vědět víc". Jeden soubor na oblast, každý má vlastní stránku. Mít ho nemusí každá oblast — odkaz se objeví jen tam, kde soubor existuje |
| `src/assets/portrety/` | Portrétní fotky, jeden soubor na kandidáta pojmenovaný podle jeho id |
| `src/pages/` | Jednotlivé stránky webu |
| `src/components/` | Opakující se části (hlavička, karta kandidáta, patička…) |
| `src/styles/tokeny.css` | **Barvy, písmo, rozestupy** — jediné místo, kde se mění vzhled globálně |
| `src/lib/temata.ts` | Seznam programových oblastí, ze kterého čerpá zbytek webu |
| `nastroje/` | Jednorázové skripty, kterými se web zakládal |

---

## Jak vyplnit medailonek

Otevřete soubor člověka ve `src/content/kandidati/` — jsou pojmenované podle
pořadí, takže dvacátý kandidát je `20-vojtech-liska.md`.

```
---
poradi: 20
jmeno: Mgr. Vojtěch Liška, Ph.D.
vek: 31
povolani: výzkumník kvantové optiky
prislusnost: příznivec České pirátské strany
citace: Věta, která se v medailonku vytáhne velkým písmem.
---

Text medailonku. Klidně několik odstavců — dá se překopírovat
z medailonku na Facebooku.
```

Nad čarou jsou údaje, pod čarou text. **Prázdné pole nevadí**, stránka se
vykreslí bez něj a nic se nerozbije.

Pár pravidel, která web hlídá sám a upozorní, když se poruší:

- `poradi` musí být vyplněné.

Fotky se do frontmatteru nepíšou vůbec — viz další oddíl.

---

## Jak přidat fotky

Fotky z fotoaparátu mají v původní velikosti klidně několik MB každá a do
gitu nepatří — jinak by si je při každém stažení repozitáře musel stáhnout
úplně každý, i když je nikdy neupravuje. Proto se nejdřív zmenší:

1. Fotku v původní velikosti pojmenujte **stejně jako soubor kandidáta**
   a uložte do `fotky-original/` — třeba fotka Vojtěcha Lišky
   (`20-vojtech-liska.md`) je `fotky-original/20-vojtech-liska.jpg`.
   Tahle složka se do gitu neukládá (viz `.gitignore`).
2. Spusťte `npm run zmensit-fotky`. Skript zmenší všechny fotky ze
   `fotky-original/` na rozumnou velikost a uloží je do
   `src/assets/portrety/` — tuhle složku už web skutečně používá a
   commituje se.

Odtud si web sám vyrobí zmenšeniny pro různé displeje, převede je do
moderních formátů a doplní ořezy — nic dalšího se nemusí nastavovat. Dokud
fotka chybí, ukáže se zástupná silueta.

---

## Jak si web pustit a zveřejnit

Nejjednodušší cesta vede přes **úlohy ve VS Code**: nabídka
**Terminál → Spustit úlohu…** (nebo Ctrl+Shift+P a „Run Task").

| Úloha | Co dělá |
|---|---|
| **0 - Pripravit pocitac** | Doplní vše potřebné. Stačí pustit jednou. Kdyby chyběl Node.js, nabídne se, že ho doinstaluje. |
| **1 - Nahled webu** | Otevře web v prohlížeči. Po uložení souboru se stránka obnoví sama. Zavírá se křížkem u panelu. |
| **2 - Zverejnit web** | Sestaví web, uloží změny a odešle je. Draft se pak do pár minut aktualizuje sám. |

Úloha „1 - Nahled webu" je zároveň výchozí, takže jde spustit i klávesou
**Ctrl+Shift+B**.

Kdo VS Code nemá, může na náhled použít soubor **`NAHLED-WEBU.bat`** —
stačí na něj dvakrát kliknout.

### Kdyby zveřejnění hlásilo chybu

Úloha web nejdřív sestaví a **teprve když se to povede, něco odešle**. Když
sestavení spadne, nic se nezveřejní a v panelu je napsané proč. Nejčastěji
je to překlep v datech — třeba chybějící pořadí, nebo u záměru téma,
které není v seznamu.

### Z terminálu

Když jsou vám bližší příkazy než nabídky:

| Příkaz | Co dělá |
|---|---|
| `npm install` | Jen poprvé — doplní součástky |
| `npm run nahled` | Web běží u vás na počítači, změny se projeví hned |
| `npm run zverejnit` | Sestaví, uloží a odešle |
| `npm run sestavit` | Jen sestaví do složky `dist/` |
| `npm run preview` | Ukáže sestavený web tak, jak ho uvidí návštěvník |
| `npm run zkouska` | Proklikne medailonky a filtry, jestli fungují (musí běžet náhled) |

---

## Nasazení

### Jednorázové nastavení na GitHubu

**Bez tohohle nasazení nepojede.** V repozitáři na GitHubu:

**Settings → Pages → Build and deployment → Source → `GitHub Actions`**

Když je místo toho zvolené *Deploy from a branch*, GitHub se pokusí web
postavit Jekyllem. Ten neumí Astro, začne číst soubory `.astro` jako by to
byla jeho konfigurace a skončí hláškou `Invalid YAML front matter`. Kdyby
se náhodou přece jen prosadil, web by se zobrazil úplně bez formátování —
Jekyll totiž zahazuje složky začínající podtržítkem a Astro do `_astro/`
ukládá všechny styly i písma. Proti tomu je v `public/` prázdný soubor
`.nojekyll`, ale správné nastavení ho nenahradí.

### Jak to pak běží

**Draft** se nasazuje sám. Cokoliv se dostane do větve `main`, se do pár minut
objeví na GitHub Pages. Draft má `noindex` a pruh „Náhled — toto zatím není
živý web", takže se nedostane do vyhledávačů ani si ho nikdo nesplete s ostrým
webem. O nasazení se stará `.github/workflows/nasadit.yml`.

Průběh je vidět na [kartě Actions](https://github.com/magrah2/TV-web/actions).
Poznat se to dá podle názvu úlohy: má běžet **`Nasadit web`**. Když tam místo
toho svítí *pages build and deployment*, je špatně nastavený zdroj — viz výš.

**Naostro** se zatím nepouští. Až se bude přepínat doména, změní se dvě věci:

1. Do sestavení přibude proměnná `NAOSTRO=1` — tím zmizí pruh i `noindex`
   a odkazy se přepnou z podsložky `/TV-web/` do kořene domény.
2. U domény se přesměrují DNS záznamy na GitHub Pages.

⚠️ **Pozor při přepínání domény:** záznamy `MX` musí zůstat u původního
poskytovatele, jinak přestane chodit pošta na `info@transparentnivyskov.cz`.
To je nejčastější chyba při stěhování webu.

---

## Mapa záměrů

Body na mapě jsou v `src/content/zamery/`, jeden soubor na místo. Nový bod
přidáte tak, že zkopírujete `_SABLONA.md`, pojmenujete kopii
`<číslo>-<nazev>.md` a vyplníte ji — nic dalšího se nikde nevypisuje.
Číslo v názvu určuje jen pořadí; mezery v číslování nevadí a při přidání
nebo odebrání bodu se nic nepřečíslovává.

```
---
nazev: Řeka Haná ve Smetanových sadech
tema: Zeleň a voda
lat: 49.28297     # zeměpisné souřadnice místa
lon: 16.99325
stav: navrh       # až text potvrdíte, přepište na: overeno
---

Řeka protéká přímo parkem, ale je z něj skoro nepoznat.
```

Dokud je `stav: navrh`, vykreslí se u bodu oranžová značka „návrh". **Polohy
bodů jsou skutečné**, dohledané z OpenStreetMap — texty jsou návrh k diskuzi
a čekají, až je někdo z týmu potvrdí nebo přepíše.

Souřadnice se nejsnáz zjistí na [mapy.cz](https://mapy.cz): pravým tlačítkem
kliknete na místo a vyberete „Souřadnice". Zadávají se zeměpisně, ne v pixelech,
takže když se výřez mapy někdy změní, body se posunou samy.

Když bod omylem umístíte mimo výřez, sestavení se zastaví a napíše který —
lepší, než aby bod potichu zmizel za okrajem.

Podklad mapy je hotový soubor `public/mapa-vyskov.svg`. Přegenerovat se dá
příkazem `node nastroje/mapa.mjs`, ale je to potřeba jen při změně výřezu.

---

## Kde volit — vyhledávač volební místnosti

Člověk napíše adresu a web mu řekne, do kterého okrsku patří a kde volí.
Data se skládají ze dvou zdrojů:

| Co | Odkud | Kdo to udržuje |
|---|---|---|
| Která adresa patří do kterého okrsku | [ČÚZK / RÚIAN](https://services.cuzk.gov.cz/sestavy/VO/) — otevřená data, CC BY 4.0 | vymezení tam zapisuje starosta |
| Kde je volební místnost | úřední vyhláška města | přepsané ručně do `src/lib/volebni-mistnosti.ts` |

Data se stáhnou a připraví příkazem:

```
node nastroje/okrsky.mjs
```

Skript si sám ověří, že převod souřadnic sedí (porovná ho s adresními body
z OpenStreetMap) a když ne, skončí chybou a nic nezapíše.

⚠️ **Před každými volbami se musí znovu projít `src/lib/volebni-mistnosti.ts`.**
Volební místnosti se mezi volbami mění a v otevřených datech nejsou — tenhle
seznam je jediné místo, kde se udržují ručně.

---

## Co ještě chybí

- [ ] Portréty kandidátů a fotky Vyškova
- [ ] Texty medailonků (kopírují se z Facebooku)
- [ ] Témata u většiny kandidátů — u některých je předvyplněný **návrh**
      odvozený z povolání, označený komentářem v souboru. Potvrdit nebo přepsat.
- [ ] Potvrdit nebo přepsat texty u bodů na mapě (všechny mají `stav: navrh`)
- [ ] Správce osobních údajů na stránce `/soukromi/` — hledejte `DOPLNIT`
