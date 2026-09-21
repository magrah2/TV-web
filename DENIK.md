# Deník a rozcestník

Dva soubory tenhle doplňuje, nenahrazuje:

- [README.md](README.md) — **návod pro tým.** Jak přidat kandidáta, fotku, bod
  na mapu, jak web pustit a zveřejnit.
- [CLAUDE.md](CLAUDE.md) — **pravidla pro práci na kódu.** Hlavně sekce
  „Co se z kódu nevyčte": seznam pastí, do kterých už jsme jednou spadli.

Tady je to, co v ani jednom z nich není: **čím se co vyrábí**, v jakém pořadí,
a **co se kdy měnilo a proč**.

---

## Co se čím vyrábí

Většina dat na webu není psaná ručně — vyrábějí je skripty a výsledek se
commituje. Kdo neví, který soubor smí upravit, najde odpověď tady.

| Skript | Co vyrobí | Kdy ho pustit |
|---|---|---|
| `nastroje/dlazdice.mjs` | `public/dlazdice/`, `public/pisma-mapy/`, `src/lib/mapa-dlazdice.json` | Když na mapě chybí něco nového (nová ulice, nová budova). Jinak nikdy. |
| `nastroje/okrsky.mjs` | `public/data/okrsky.json`, `public/data/okrsky-plochy.json` | Před volbami a po každé úpravě `src/lib/volebni-mistnosti.json`. |
| `nastroje/nahledy-map.mjs` | `src/assets/nahled-mapa-*.png` | Když mapa viditelně změní vzhled. |
| `nastroje/nahledy-sdileni.mjs` | `public/nahledy/*.png`, `src/lib/nahledy-sdileni.json` | Když se změní mapa, lístek, dlaždice programu nebo portréty. |
| `nastroje/zmensit-fotky.mjs` | `src/assets/portrety/*.jpg` | **Sám**, před každým sestavením i náhledem. Ručně netřeba. |
| `nastroje/dokument-program.mjs` | `dokument/*.docx` (mimo git) | Když tým chce program do Google Docs. |
| `nastroje/zkouska.mjs` | — | Před každým zveřejněním: `npm run zkouska`. |
| `nastroje/zverejnit.mjs` | — | `npm run zverejnit` — sestaví, uloží a odešle na GitHub. |

`nastroje/vyrez-obce.mjs` není nástroj, ale společné nastavení: výřez území
obce a jeho přepočet. Sdílejí ho generátor dlaždic i generátor okrsků, aby se
nemohly rozejít.

`zaloz-kandidaty.mjs` a `zaloz-program.mjs` byly jednorázové, na začátku
projektu. Pouštět je znovu by přepsalo obsah.

### Na pořadí záleží

Některé skripty čtou, co vyrobil jiný. Když se pouští víc najednou, tak
v tomhle pořadí:

```
1. dlazdice.mjs          (okrsky z nich čtou obrysy domů)
2. okrsky.mjs
3. npm run nahled        ← musí běžet v jiném okně
4. nahledy-map.mjs       (fotí živou stránku)
5. nahledy-sdileni.mjs   (vkládá do karet výsledek kroku 4)
```

---

## Deník

### Září 2026 — mapy

Největší přestavba od spuštění. Všechny tři mapy na webu — záměry, volební
okrsky, sběr podnětů — stály na různých podkladech a rozjížděly se: na jedné
byla řeka zelená, na druhé modrá. Teď mají jeden společný.

**Jeden podklad pro všechny tři mapy** (`59ba791`). Vlastní SVG podklad
nahradily vektorové dlaždice. Ty se ale **nestahují za běhu** — leží
v repozitáři a stahuje je jednorázově `dlazdice.mjs`. Web tak dál neposílá
jediný požadavek ven a nepotřebuje cookie lištu; výjimka pro `/stanek/`
z CLAUDE.md úplně zmizela. Hlídá to zkouška: počítá požadavky na cizí host
a čeká nulu.

Bez JavaScriptu se vektorová mapa nevykreslí, takže místo ní je obrázek téže
mapy a odkaz na text, který funguje i bez skriptu (`21d3f9b`).

**Plochy volebních okrsků** dostaly tři opravy za sebou, jak vyplouvaly chyby:

1. `f4f2462` — hranice procházela domům přes střechu. Generátor teď čte
   obrysy domů z našich vlastních dlaždic a každý dům otiskne celý.
2. `8e6486f` — plochy se překrývaly a jinde mezi nimi zely mezery. Příčina:
   obrys se vyhlazoval u každé oblasti zvlášť, takže se společná hranice
   u každé z nich ohnula jinam. Zjednodušují se proto **úseky hranice**, ne
   oblasti, a narovnání nikdy neprotne dům.
3. `7058db6` — dva sousední domy si dělily buňku mřížky a ten pozdější ten
   první přepsal. Buňka je teď pět metrů a otiskuje se nadvakrát.

Zbývají dva domy v cizí barvě: **Husova 4** a **Hřbitovní 2**. Není to chyba —
mají adresy ve dvou okrscích a jedna barva prostě prohrát musí.

**Barvy** (`71e4946`). Osm programových oblastí mělo jen odstíny modré
a zelené z loga a na mapě je nešlo rozlišit. Paleta je širší, ale sdílená:
mapa záměrů i mapa okrsků berou ze stejné sady. Modrá v paletě okrsků není
vůbec — mapa je sama modrá a plocha v ní zanikne.

**Modrý pruh přes půlku mapy v Chromu.** Vlekl se od nasazení vektorové mapy.
Objevil se, když mapa vyjela nad horní okraj okna, a zůstal. Jen Chrome,
v Brave ne, jen na počítači, na všech třech mapách.

Příčina: **lepivá hlavička byla dokonale neprůhledná**. Taková lišta je pro
prohlížeč clona — co je pod ní, nemusí kreslit. Nad plátnem WebGL si ale
Chrome vynechávanou část odečítal od špatného konce: kolik mapy zakryla
hlavička nahoře, tolik jí zmizelo u spodní hrany. Hlavička má proto teď
pozadí s půl promilem průhlednosti a clonou pro prohlížeč není.

Hledalo se to dlouho a špatně, protože všechno ukazovalo na mapu. Postupně se
vyloučil podklad stránky, velikost plátna, ztráta kontextu WebGL, chybějící
dlaždice, zaoblený ořez rámu i `preserveDrawingBuffer`. Rozhodly dvě věci:
**výpis obsahu plátna přes `toDataURL` vedle živé mapy** (mapa na něm byla
celá — takže plátno obsah má a nezobrazuje ho prohlížeč) a **změření pruhu
při dvou polohách rolování** (rostl 1 : 1 s odrolováním, tedy překlopená osa).

Pokusy, které nic neopravily, jsou vrácené: `preserveDrawingBuffer` (byl
zapnutý právě proti tomuhle pruhu, takže zůstal vypnutý), `overflow: clip`
místo `hidden`, `will-change` a `translateZ(0)` na plátně i na mapě,
a `background-attachment: fixed` místo `body::before`.

**Drobnosti:** vybraný bod se schovával pod sousedy (`c13d9eb`), uvedení
zdrojů bylo černé na tmavé mapě (`aecdc71`, `ff145a9`), horní lišta
prosvítala (`9b7e993`).

### Září 2026 — mimo mapy

- **Náhledy pro sdílení** (`21d3f9b`). V hlavičce nebyl žádný `og:image`,
  takže Messenger i Facebook ukazovaly holý odkaz. Každá hlavní stránka má
  teď vlastní kartu; skládá se jako obyčejná stránka a fotí v prohlížeči.
- **Přejmenování** (`b69b523`). `/lide/` → `/kandidati/`, `/stanek/` →
  `/mapa-napadu/`. Stará `/lide/` přesměrovává.
- **Fotky** (`98f8a78`). Zmenšování z `fotky-original/` se muselo spouštět
  ručně a dalo se na to zapomenout. Běží samo před každým sestavením.
- **Nasazení** (`acb38d8`). Na FTP se při každém nasazení znovu přenášelo
  147 dlaždic. `lftp` porovnává podle času a sestavení v CI vyrábí soubory
  pokaždé znovu; u dlaždic se proto čas ignoruje.

---

## Co zůstává otevřené

- **Ostrá doména běží na starším sestavení.** Draft na GitHub Pages se
  nasazuje sám, naostro se pouští ručně: Actions → „Naostro na FTP" →
  Run workflow.
- **PHP na hostingu není ověřené.** Sběr podnětů na `/mapa-napadu/` ukládá
  přes `public/podnety.php`. Jestli tam PHP skutečně běží, se pozná až po
  nasazení naostro se secretem `SBER_HESLO`.
- **Hosting nečte `.htaccess`.** Ověřeno nesmyslnou direktivou ve zkušební
  podsložce. Nemá smysl do něj psát další pravidla.
- **Zoopark se v OpenStreetMap jmenuje špatně.** Náš styl to obchází výčtem
  v `styl-mapy.ts`. Správné řešení je opravit to přímo v OSM.
