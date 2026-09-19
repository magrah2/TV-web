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

## Grafika drží pohromadě

Zelená stopa z loga (`src/components/Krivka.astro`) je hlavní grafický prvek
webu a cesta je doslova vytažená ze značky.

Původně tu stálo, že žádná další grafika přibývat nesmí. To bylo moje
vlastní pravidlo, ne zadání od týmu, a bylo přísnější, než je zdrávo —
ikony na dlaždicích programu web nerozbily, naopak. Platí tedy měkčí verze:

**Grafika smí přibývat, ale musí být součástí jedné soustavy, ne sbírkou
klipartů.** Co už v soustavě je:

- **Ikony programových oblastí** (`src/components/IkonaTematu.astro`) —
  mřížka 24 × 24, obrys tahem 1,75 a k němu jedna tlumená plocha ve stejné
  barvě, zakulacené konce, `currentColor` obarvený barvou oblasti
  z `BARVA_TEMATU`.
- **Znaky Facebooku a Instagramu** na `/kontakt/` — tam nejde o ozdobu, ale
  o značku, podle které člověk odkaz pozná dřív, než si ho přečte.

Dvě věci platí bez výjimky:

1. **Kreslí se inline v repozitáři, nikdy se nic nestahuje odjinud.** Web
   nesmí posílat požadavky na cizí servery.
2. **Barvy jen z palety značky.** Nic mimo `tokeny.css` a `BARVA_TEMATU`.

A ještě jedna zkušenost: ikonu nemá smysl posuzovat z kódu. Z první sady
neobstály tři — mince se malá četla jako cizí symbol, vstupenka vypadala
jako mašle a dům měl střechu levitující nad stěnami. Vyplavalo to, teprve
když jsem si je vykreslil vedle sebe ve velkém i v cílové velikosti.

## Zásady, které platí všude

1. **Žádné modály na uvítanou, žádná vyskakovací okna.** Detaily se
   rozbalují na místě. Medailonek je jediný překryv a otevírá ho výhradně
   kliknutí uživatele.
2. **Bez JavaScriptu web funguje.** Medailonky otevírá CSS `:target`,
   odkazy jsou skutečné odkazy. Ovládání, které bez JS nefunguje (filtry),
   je v HTML `hidden` a odkrývá ho až skript — **žádná mrtvá tlačítka**.
3. **Žádné požadavky ven, bez výjimky.** Písmo je self-hosted, mapové
   dlaždice i písma popisků leží v repozitáři (`public/dlazdice/`,
   `public/pisma-mapy/`) a stahuje je jednorázově `nastroje/dlazdice.mjs`.
   Web nesmí načítat nic z cizích serverů — je to důvod, proč nepotřebuje
   cookie lištu, a u strany s tímhle názvem to není detail.

   Hlídá to `npm run zkouska`: u obou veřejných map počítá, kolik požadavků
   odešlo na jiný host, a čeká nulu. Kdyby se někdy do `styl-mapy.ts` vrátila
   adresa veřejné služby, zkouška spadne.

   Uvedení zdrojů v rohu mapy je podmínka licence OpenStreetMap
   i OpenMapTiles — **nesmí zmizet.**
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
psané natvrdo by po přepnutí vedly vedle. Vždy `odkaz('/kandidati/')`
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
- **Body na mapě se ukládají jako `lat`/`lon`, nikdy v jednotkách mapy.**
  Mapa se posouvá a přibližuje, takže souřadnice pevné k jednomu výřezu by
  po prvním posunu ukazovaly jinam. Platí to i pro plochy okrsků — proto je
  `nastroje/okrsky.mjs` vydává jako GeoJSON, ne jako cesty v SVG.
- **Odznaky na mapě se nerozestrkávají a v centru se překrývají.** Je to
  záměr. Sedm záměrů leží v okolí náměstí do 400 metrů od sebe a odznak má
  na mapě města průměr skoro tři sta metrů — na tolik odznaků tam místo
  není. Dřív je rozestrkávala funkce `rozestrciBody()`, ale ta narazila na
  svůj strop a odsunula Masarykovo náměstí o dvě stě metrů, tedy mimo
  náměstí. Přesná poloha je důležitější než mezera mezi odznaky: kdo chce
  mít mezi nimi místo, přiblíží si mapu, a vybraný bod se stejně vytáhne
  dopředu (`z-index` u `.je-zvyrazneny`).
- **Mapa se musí překreslit po každé změně rozměru rámu.** Knihovna sama
  sleduje jen změnu velikosti okna. Když rám vyroste z jiného důvodu, plátno
  zůstane v původní výšce a u spodní hrany zeje tmavý pruh, ve kterém mapa
  není vykreslená — vypadá to jako lišta přes mapu. Řeší to `ResizeObserver`
  ve `vytvorMapu()`.
- **Zdvořilé ovládání platí jen na dotyku.** Na telefonu se mapa posouvá
  dvěma prsty, aby šlo palcem projet stránku. Na počítači ale kolečko
  přibližuje rovnou, bez Ctrl — držet Ctrl nad mapou nikdo nechce. Knihovna
  umí jen obojí najednou, takže se rozhoduje podle `(pointer: coarse)`.
- **Značka na mapě nesmí mít vlastní `transform`.** Polohu jí nastavuje
  knihovna právě přes `transform`; cokoliv vlastního na témže prvku —
  zvětšení při najetí, blikání — jí ho přepíše a značka odskočí do rohu mapy.
  Proto je vnější prvek vždycky jen obal bez vzhledu a všechno se děje uvnitř
  něj. Hlídá to `npm run zkouska`.
- **Adresa dlaždic musí být úplná, i s doménou.** Nestahuje je stránka, ale
  vlákno na pozadí, kterému je `/TV-web/…` k ničemu — skončí chybou „Failed
  to parse URL". Skládá se prostým spojením řetězců, ne přes `new URL`: ten
  by složené závorky v šabloně zakódoval na `%7B`.
- **`maxBounds` musí být větší než obec.** Obec je skoro čtvercová, rám mapy
  na širokém displeji ne — aby se celá vešla na výšku, musí mapa do šířky
  ukázat skoro dvakrát tolik. Když hranice končila na katastru, mapa se na
  takový pohled vůbec nedala nastavit a zůstala přiblížená na střed. Proto
  se u oddálených zoomů stahuje i kus okolních polí.
- **Plochy na mapě se dělí podle budov, ne podle okrsků.** Voliče nezajímá
  číslo okrsku, ale kam má jít; několik okrsků často volí na stejném místě.
  Slučuje se to už při rasterizaci, jinak by uvnitř jedné oblasti zůstaly
  zbytečné vnitřní hranice.
- **Hranice oblasti nesmí vést přes dům.** Samotné hlasování sousedních adres
  ji vede, kudy zrovna vyjde — a od chvíle, kdy mapa kreslí i domy, je na
  první pohled vidět půlka domu jednou barvou a půlka druhou. Generátor proto
  čte obrysy domů z našich vlastních dlaždic a každý dům do mřížky **otiskne
  celý**, včetně buněk, kterých se jen dotkne. Kdyby se ptal jen na střed
  buňky, běžný dům by se do žádného netrefil a hranice by mu pořád mohla vést
  přes střechu.
- **Značková zelená na mapě patří jen nám.** Vybraná volební oblast, odznaky
  záměrů, body podnětů — nic jiného. Dokud ji měly i parky, hřbitovy
  a Dinopark, svítily z mapy, jako by to bylo to nejdůležitější ve Vyškově.
  Pojmenované zelené areály proto mají vlastní `--mapa-areal`, o stupeň
  světlejší než les.
- **Zelená na mapě „kde volit" je vyhrazená vybrané oblasti.** V paletě ploch
  proto zelená není — jinak by nešlo poznat, která oblast je ta vaše.
  Barvy oblastí jsou v tokenech jako `--mapa-oblast-1` až `-6`; mapa je čte
  přes `BARVY_OBLASTI`, protože plochy nekreslí CSS, ale knihovna.
- **Klik na značku volební místnosti musí zastavit probublání.** Značka leží
  uvnitř mapy, takže klik na ni doputuje i k ní a mapa si pak vybere oblast
  pod kurzorem sama. Plochy se u sebe překrývají, takže klidně jinou, než ke
  které značka patří.
- **Z jednoho bodu obrysu může vycházet víc hran.** Stává se to tam, kde se
  dvě části téže oblasti dotýkají rohem. Když se držela jen jedna, smyčky se
  splácly dohromady a obrysem vedla přeložená čára napříč plochou.
- **Adresa volební místnosti se hledá nejdřív podle čísla orientačního.**
  Vyhláška píše čísla tak, jak jsou na domech. Stejné číslo existuje i v řadě
  popisných, takže bez toho pořadí trefí „Slovanská 111" dům o 200 m vedle.
- **Náhled pro sdílení musí být úplná adresa i s doménou.** Sociální síť si
  stránku stahuje u sebe, takže `/nahledy/mapa.png` by jí nic neřeklo.
  A z cesty se před hledáním karty musí odstranit `BASE_URL` — na draftu by
  se jinak první částí cesty stalo `TV-web` a všechny stránky by dostaly
  výchozí kartu.
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
