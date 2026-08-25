# Kontext projektu

Volební web sdružení **Transparentní Vyškov** pro komunální volby
**9.–10. října 2026**. Statický web postavený v Astru, nasazovaný na GitHub Pages.

Návod pro tým je v [README.md](README.md) — tenhle soubor je pro práci na kódu.

---

## Píše se česky

Kód, komentáře, názvy proměnných, commity i hlášky skriptů. Do repozitáře
budou sahat i lidé, kteří programovat neumí, a mají mít šanci se v tom vyznat.

Výjimka: klíčová slova jazyka a názvy z Astra (`getCollection`, `Astro.props`).

## Výpisy do terminálu jsou bez diakritiky

Windows konzole běží ve starším kódování a české znaky v ní vycházejí jako
klikyháky. Cokoliv, co skript **tiskne** — hlášky, chybové zprávy, nápovědy —
se píše bez háčků a čárek. Platí to pro `nastroje/*.mjs`, `nastroje/*.ps1`
i dávkové soubory.

Komentáře ve zdroji, texty na webu a zprávy do gitu diakritiku mít mají —
ty se čtou v editoru nebo v prohlížeči, kde se zobrazí správně.

## Komentáře vysvětlují proč, ne co

Kód říká, co dělá. Komentář má říct, proč to tak je — obzvlášť u věcí, které
vypadají jako přehlédnutí. Například:

```css
/* Bez tohohle by `hidden` neúčinkovalo: `display: grid` z třídy přebije
   `display: none`, které prohlížeč atributu `hidden` dává sám. */
.filtry[hidden] { display: none; }
```

## Vzhled se mění jen v tokenech

Barvy, písmo, rozestupy a stíny jsou v `src/styles/tokeny.css`. Nikde jinde
se nesmí objevit natvrdo zapsaná barva. Vzhled jednotlivých částí patří do
`<style>` v příslušné komponentě (Astro je scopuje samo).

**Modrá `#1d6eb0` a zelená `#5bae39` jsou vytažené přímo z loga.**
Zelená má na světlém pozadí kontrast jen 2,9 : 1 — **na text se nikdy
nesmí použít**, od toho je `--zelena-text`.

## Grafický motiv je jeden

Zelená stopa z loga (`src/components/Krivka.astro`) je jediný dekorativní
prvek webu. Cesta je doslova vytažená ze značky. Žádné další ozdoby,
ikonky ani tvary nepřibývají — jinak se web rozpadne.

## Zásady, které platí všude

1. **Žádné modály na uvítanou, žádná vyskakovací okna.** Detaily se
   rozbalují na místě. Medailonek je jediný překryv a otevírá ho výhradně
   kliknutí uživatele.
2. **Bez JavaScriptu web funguje.** Medailonky otevírá CSS `:target`,
   odkazy jsou skutečné odkazy. Ovládání, které bez JS nefunguje (filtry),
   je v HTML `hidden` a odkrývá ho až skript — **žádná mrtvá tlačítka**.
3. **Žádné požadavky ven.** Písmo je self-hosted, mapa bude vlastní SVG.
   Web nesmí načítat nic z cizích serverů — je to důvod, proč nepotřebuje
   cookie lištu, a u strany s tímhle názvem to není detail.
4. **Nic vymyšleného se nevydává za program.** Co jsem odhadl a tým to
   nepotvrdil, musí být viditelně označené jako návrh (`stav: navrh`,
   komentář `# NÁVRH` v datech).

## Data hlídá schéma

`src/content.config.ts` popisuje, jak mají data vypadat. Překlep v tématu
nebo chybějící pořadí **shodí sestavení** — to je záměr, chyba se má ukázat
nám, ne návštěvníkovi.

Nevyplněná pole jsou `nullish()`, ne `optional()`. V YAML je `foto:` bez
hodnoty `null`, ne chybějící klíč, a `optional()` by null odmítl — každý
nevyplněný řádek v šabloně by shodil build.

## Odkazy jen přes `odkaz()`

Draft běží v podsložce `/TP-web/`, ostrý web bude v kořeni domény. Odkazy
psané natvrdo by po přepnutí vedly vedle. Vždy `odkaz('/lide/')`
z `src/lib/odkaz.ts`.

---

## Ověřování

Než něco prohlásím za hotové, musí projít:

```
npm run build          # sestavení nesmí hlásit chybu ani varování
npm run preview        # a pak se na to skutečně podívat
npm run zkouska        # proklikání medailonků a filtrů
```

Na vzhled se **dívám snímkem obrazovky**, nehádám ho z kódu. V minulosti
takhle vyplavaly chyby, které z kódu vidět nebyly: pořadové číslo přeleze
přes jméno, mezi sekcemi je dvojnásobná mezera, ve jménech zůstaly tečky
po odstraněných titulech.

Testuje se i **s vypnutým JavaScriptem** a **na šířce 390 px**.

## Co se z kódu nevyčte

- **Rozestupy sekcí se sčítají.** `.sekce` má odsazení nahoře i dole,
  takže mezi dvěma sousedními je hodnota `--mezera-sekce` dvakrát.
- **`\b` na konci regexu titulů nestačí.** Za `Bc.` následuje mezera a
  hranice slova mezi `.` a ` ` neexistuje, takže tečka ve jméně zůstane.
  Proto `(?=[\s,]|$)`.
- **Delší tituly musí být v regexu před kratšími** (`Ph\.D` před `PhDr`).
- **`<span>` neunese `<div>`.** Obal portrétu musí být `div`, protože
  komponenta `Portret` vrací blokový prvek.
- **Přeskok mezi medailonky nesmí nafukovat historii.** Zavírací křížek dělá
  krok zpět; kdyby každý skok na dalšího člověka přidal záznam, „zavřít" by
  znamenalo „vrať se k předchozímu" a po delším listování by to vypadalo,
  že panel zavřít nejde. Proto se při přeskoku volá `replaceState`,
  ne `pushState`. Hlídá to `npm run zkouska`.
- **Písma patří do `src/`, ne do `public/`.** Odkaz `url('/pisma/…')` v CSS
  by na draftu mířil vedle, protože ten běží v podsložce `/TP-web/`.
  Relativní cesta ze `src/` si nechá adresu dopočítat od Astra. Adresy pro
  `preload` se ze stejného důvodu importují přes `?url` — jinak by preload
  stahoval jiný soubor, než jaký si pak vyžádá CSS.

## Kde to stojí

Otevřené body jsou v README v sekci „Co ještě chybí". Zkráceně:
chybí fotky, texty medailonků, mapa záměrů a interaktivní volební lístek.
Na `/soukromi/` je nedodělek označený `DOPLNIT`.

**Před stavbou volebního lístku ověřit:** co se stane, když volič označí
stranu a zároveň jednotlivce z **téže** strany. Zbytek pravidel je ověřený
proti zákonu 491/2001 Sb. a shodně ho popisuje Ministerstvo vnitra.

---

## Astro

Dokumentace: https://docs.astro.build

Vývojový server se spouští na pozadí: `astro dev --background`
(ovládá se `astro dev stop`, `status`, `logs`).
