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

**Povolené výjimky jsou dvě a obě mají důvod:**

1. **Znaky Facebooku a Instagramu** u odkazů na `/kontakt/`. Nejsou to
   ozdoby — jsou to značky, podle kterých člověk odkaz pozná dřív, než si ho
   přečte, a bez nich vypadala obě tlačítka stejně.
2. **Ikony programových oblastí** (`src/components/IkonaTematu.astro`) na
   dlaždicích a na `/program/`.

Obojí je nakreslené jako inline SVG, ne stažené odjinud: web nesmí posílat
požadavky na cizí servery. Ikony oblastí drží jednu soustavu — mřížka
24 × 24, tah 1,75, zakulacené konce, `currentColor` obarvený barvou oblasti
z `BARVA_TEMATU` — jinak by z toho byla sbírka klipartů. Nová oblast musí
dostat ikonu, jinak sestavení spadne; tichá mezera na dlaždici by se nepoznala.

**Nic dalšího už ne.** Každá další ikona ředí to, že web má jeden motiv.

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

Draft běží v podsložce `/TV-web/`, ostrý web bude v kořeni domény. Odkazy
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
- **`<details>` už nejde odkrýt přes `display`.** Novější prohlížeče skrývají
  jeho obsah přes `::details-content { content-visibility: hidden }`, takže
  `display: block !important` nestačí. Proto má hlavička dva samostatné prvky:
  vypsané odkazy pro široký displej a `<details>` pro úzký. Kvůli tomuhle
  navigace na počítači jednou zmizela úplně.
- **Body na mapě se ukládají jako `lat`/`lon`, ne jako procenta.** Procenta
  platí jen pro jeden výřez; po oddálení mapy by se všechny rozjely.
  Přepočet dělá `src/lib/mapa.ts` podle `mapa-vyrez.json`, který zapisuje
  generátor — jeden zdroj pravdy.
- **Odznaky na mapě se nerozestrkávají a v centru se překrývají.** Je to
  záměr. Sedm záměrů leží v okolí náměstí do 400 metrů od sebe a odznak má
  na mapě města průměr skoro tři sta metrů — na tolik odznaků tam místo
  není. Dřív je rozestrkávala funkce `rozestrciBody()`, ale ta narazila na
  svůj strop a odsunula Masarykovo náměstí o dvě stě metrů, tedy mimo
  náměstí. Přesná poloha je důležitější než mezera mezi odznaky: kdo chce
  mít mezi nimi místo, přiblíží si mapu, a vybraný bod se stejně vytáhne
  dopředu (`z-index` u `.je-zvyrazneny`).
- **Mapa se zvětšuje `viewBox`em, ne `transform: scale()`.** Se `scale()` si
  prohlížeč SVG jednou vykreslí do bitmapy a tu pak natahuje — při přiblížení
  z toho byly kostičky. Značky nad mapou jsou HTML a polohu si přepočítávají
  podle `viewBox`u. Hlídá to `npm run zkouska`.
- **Plochy na mapě se dělí podle budov, ne podle okrsků.** Voliče nezajímá
  číslo okrsku, ale kam má jít; několik okrsků často volí na stejném místě.
  Slučuje se to už při rasterizaci, jinak by uvnitř jedné oblasti zůstaly
  zbytečné vnitřní hranice.
- **Zelená na mapě „kde volit" je vyhrazená vybrané oblasti.** V paletě ploch
  proto zelená není — jinak by nešlo poznat, která oblast je ta vaše.
- **Z jednoho bodu obrysu může vycházet víc hran.** Stává se to tam, kde se
  dvě části téže oblasti dotýkají rohem. Když se držela jen jedna, smyčky se
  splácly dohromady a obrysem vedla přeložená čára napříč plochou.
- **Adresa volební místnosti se hledá nejdřív podle čísla orientačního.**
  Vyhláška píše čísla tak, jak jsou na domech. Stejné číslo existuje i v řadě
  popisných, takže bez toho pořadí trefí „Slovanská 111" dům o 200 m vedle.
- **Písma patří do `src/`, ne do `public/`.** Odkaz `url('/pisma/…')` v CSS
  by na draftu mířil vedle, protože ten běží v podsložce `/TV-web/`.
  Relativní cesta ze `src/` si nechá adresu dopočítat od Astra. Adresy pro
  `preload` se ze stejného důvodu importují přes `?url` — jinak by preload
  stahoval jiný soubor, než jaký si pak vyžádá CSS.

## Pravidla hlasování jsou ověřená — neměnit od oka

Volební lístek (`src/components/VolebniListek.astro`) počítá, komu připadne
hlas. Kdyby počítal špatně, učili bychom lidi volit špatně. Pravidla jsou
ověřená proti zákonu č. 491/2001 Sb. a shodně je popisuje Ministerstvo vnitra:

1. Křížek u strany → hlas dostanou **všichni** její kandidáti v pořadí.
2. Křížky u jednotlivců → nejvýš 27 (tolik má Vyškov zastupitelů).
3. Strana + jednotlivci z **jiných** stran → nejdřív se počítají jednotlivci,
   zbytek z 27 hlasů dostanou kandidáti označené strany **odshora**.
4. Strana + jednotlivci z **téže** strany → křížky u jednotlivců se
   **ignorují**, hlas platí pro celou stranu. Lístek zůstává platný.
5. Neplatný → víc než jedna strana, nebo víc než 27 jednotlivců.

Každé z těch pravidel hlídá `npm run zkouska`. Když se logika mění, musí se
měnit i zkouška — ne naopak.

## Vyhledávač volební místnosti

Říká lidem, kam mají jít volit — tedy věc, u které chyba pošle člověka do
špatné místnosti. Proto se nikde neopisuje ručně to, co jde vzít z dat:
přiřazení adres k okrskům je z otevřených dat ČÚZK (RÚIAN), kde ho vede
starosta. Ručně se udržuje jen seznam místností, který v datech není.

Ověřuje se to křížem: `npm run zkouska` kontroluje, že vyhledávač dá stejný
výsledek jako úřední vyhláška města (Dukelská 2 → okrsek 2 → knihovna).

Souřadnice z ČÚZK jsou v S-JTSK. Převod se **nepočítá z Křovákových konstant**,
ale napasuje se na skutečné adresní body z OpenStreetMap — Křovák je konformní,
takže na území jednoho města je vztah prakticky afinní. Generátor si přesnost
sám změří (naposledy 0,44 m průměrně, 2,89 m nejhůř) a když by přesáhla pět
metrů, skončí chybou a nic nezapíše.

## Kde to stojí

Otevřené body jsou v README v sekci „Co ještě chybí". Zkráceně: chybí fotky
a texty medailonků. Body na mapě už tým potvrdil, takže mají `stav: overeno`
a značka „návrh" se nikde nevykresluje — nový bod ze šablony ale začíná
jako `navrh` a značku dostane.

---

## Astro

Dokumentace: https://docs.astro.build

Vývojový server se spouští na pozadí: `astro dev --background`
(ovládá se `astro dev stop`, `status`, `logs`).
