import tokeny from '../styles/tokeny.css?raw';
import { odkaz } from './odkaz';
import dlazdice from './mapa-dlazdice.json';

/**
 * Vlastní styl vektorové mapy pro sběr podnětů.
 *
 * Proč vůbec: rastrové dlaždice jsou obrázky s barvami zapečenými dovnitř.
 * Přebarvit v nich jednotlivě silnici nebo park nejde — jde jen položit přes
 * ně filtr, který obarví všechno najednou včetně popisků. Vektorové dlaždice
 * posílají tvary a barvu jim určuje až tenhle styl, takže si každý prvek
 * obarvíme sami.
 *
 * Barvy se čtou z `tokeny.css`, aby nebyly zapsané na dvou místech. Styl
 * potřebuje skutečné hodnoty, ne `var(--…)`: mapa se nekreslí přes CSS.
 *
 * Používá se schéma OpenMapTiles, tedy pojmenování vrstev, které mají
 * dlaždice uvnitř (`water`, `transportation`, `building`…).
 */

function token(nazev: string): string {
  const shoda = tokeny.match(new RegExp('--' + nazev + ':\\s*([^;]+);'));
  if (!shoda) throw new Error('V tokeny.css chybí --' + nazev);
  return shoda[1].trim();
}

const BARVA = {
  pozadi: token('noc'),
  zastavba: token('mapa-zastavba'),
  prumysl: token('mapa-prumysl'),
  zelen: token('mapa-zelen'),
  voda: token('mapa-voda'),
  potok: token('mapa-potok'),
  cesta: token('mapa-cesta'),
  ulice: token('mapa-ulice'),
  silnice: token('mapa-silnice'),
  hlavni: token('mapa-silnice-hlavni'),
  zeleznice: token('mapa-zeleznice'),
  zelenZnacky: token('zelena'),
  popisek: token('na-noci'),
  popisekTlum: token('na-noci-tlum'),
};

/**
 * Podklad si hostujeme sami.
 *
 * Dlaždice i písma popisků leží v repozitáři (`public/dlazdice`,
 * `public/pisma-mapy`) a stahuje je jednorázově `nastroje/dlazdice.mjs`.
 * Kdyby se bralo z verejne sluzby OpenFreeMap, posilal by kazdy navstevnik
 * svoji IP adresu na cizi server — a padlo by tim pravidlo, kvuli kteremu
 * web nepotrebuje cookie listu.
 *
 * Adresy musí projít `odkaz()`, protože draft běží v podsložce `/TV-web/`.
 * Složené závorky si doplňuje MapLibre sám, `odkaz()` je nechává být.
 */
/**
 * Adresa musí být úplná, i s doménou.
 *
 * Dlaždice si nestahuje stránka, ale vlákno na pozadí, které knihovna
 * používá na jejich rozbalení. Tomu je adresa `/TV-web/…` k ničemu — nemá
 * ji k čemu vztáhnout a skončí chybou „Failed to parse URL".
 *
 * Skládá se prostým spojením řetězců, ne přes `new URL`: ten by složené
 * závorky v šabloně zakódoval na `%7B` a knihovna by do nich pak nedosadila
 * čísla dlaždice.
 */
const doma = (cesta: string) =>
  (typeof location === 'undefined' ? '' : location.origin) + odkaz(cesta);

const DLAZDICE = doma('/dlazdice/{z}/{x}/{y}.pbf');
const PISMA = doma('/pisma-mapy/{fontstack}/{range}.pbf');

/**
 * Rozsah stažených dlaždic a území, které pokrývají.
 *
 * Čte se z průvodky, kterou zapisuje `nastroje/dlazdice.mjs` — jeden zdroj
 * pravdy. Kdyby se čísla opisovala sem, po změně výřezu by se to tiše
 * rozešlo a mapa by na okraji zbělela.
 *
 * `nejvetsiZoom` neznamená, že se dál nejde přiblížit: bližší pohled si
 * MapLibre dopočítá z dlaždic zoomu 14. `nejmensiZoom` strop je — pod ním
 * už žádná data nemáme.
 */
export const DLAZDICE_POKRYVAJI = dlazdice;

/**
 * Uvedeni zdroje. Je to podminka licence obou projektu, nesmi zmizet.
 * Vykresluje ho MapLibre v rohu mapy.
 */
export const ZDROJ_DAT =
  '© přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' +
  ' · dlaždice <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>' +
  ' © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>';

/**
 * Barvy oblastí na mapě „kde volit" a barva té vybrané.
 *
 * Čte se odsud, protože plochy okrsků nekreslí CSS, ale mapa — a ta chce
 * skutečnou hodnotu, ne `var(--…)`. Jeden zdroj pravdy zůstává v tokenech.
 */
export const BARVY_OBLASTI = [1, 2, 3, 4, 5, 6].map((i) => token('mapa-oblast-' + i));
export const BARVA_VYBRANE_OBLASTI = token('zelena');

/**
 * Šířka čáry, která roste s přiblížením.
 *
 * Zapisuje se jako výraz, ne jako starý objekt se `stops`. Ten novější
 * knihovna neumí a celou vrstvu kvůli němu zahodí — mapa pak zůstane prázdná
 * a nikde nic nehlásí.
 */
function sirka(body: [number, number][]) {
  return ['interpolate', ['exponential', 1.4], ['zoom'], ...body.flat()];
}

/** Hodnota, která se plynule mění s přiblížením. */
function podleZoomu(body: [number, number][]) {
  return ['interpolate', ['linear'], ['zoom'], ...body.flat()];
}

/** Filtr „třída je jedna z…" v moderním zápisu. */
function jeTrida(...tridy: string[]) {
  return ['match', ['get', 'class'], tridy, true, false];
}

/**
 * Je to zpevněná cesta?
 *
 * Chodník a cyklostezka ano, polní cesta ne. Povrch se bere jako druhé
 * vodítko, protože v datech u spousty cest chybí.
 */
const JE_ZPEVNENA = [
  'any',
  ['match', ['get', 'subclass'], ['footway', 'cycleway'], true, false],
  ['==', ['get', 'surface'], 'paved'],
];

/**
 * Název místa, jak se má ukázat na mapě.
 *
 * Vychází z dat OpenStreetMap, ale u zooparku se opravuje: v datech je
 * zapsaný jako „Zoologická zahrada Vyškov", jenže tak se nejmenuje a přívlastek
 * „Vyškov" je na mapě Vyškova navíc. Správné řešení je opravit to přímo
 * v OpenStreetMap — do té doby to sedí aspoň tady.
 *
 * Výrazy neumí nahrazovat text, takže se to dělá výčtem. Až jméno v datech
 * někdo opraví, tahle větev se prostě přestane používat.
 */
const NAZEV_MISTA = [
  'match',
  ['get', 'name'],
  ['Zoologická zahrada Vyškov', 'Zoologická zahrada a zámek Vyškov'],
  'Zoo Park',
  ['get', 'name'],
];

/** Filtr „třída není…" */
function neniTrida(trida: string) {
  return ['!=', ['get', 'class'], trida];
}

export const STYL_MAPY = {
  version: 8,
  glyphs: PISMA,
  sources: {
    openmaptiles: {
      type: 'vector',
      tiles: [DLAZDICE],
      minzoom: DLAZDICE_POKRYVAJI.nejmensiZoom,
      maxzoom: DLAZDICE_POKRYVAJI.nejvetsiZoom,
      attribution: ZDROJ_DAT,
    },
  },
  layers: [
    { id: 'pozadi', type: 'background', paint: { 'background-color': BARVA.pozadi } },

    // --- Plochy -----------------------------------------------------------
    {
      id: 'zelen',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      // Pole se schválně nekreslí. Na ostatních mapách webu jsou pozadí
      // a tady zabírají skoro celý okolní kraj — natřené zeleně přebijí
      // město, tedy to jediné, na co se člověk dívá.
      filter: jeTrida('wood', 'grass'),
      paint: { 'fill-color': BARVA.zelen, 'fill-opacity': 0.9 },
    },
    {
      id: 'parky',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      // Parky dostávají zelenou ze značky. Jsou malé, takže výraznější odstín
      // je neutopí v ploše — a je na nich hned vidět, že jsou to parky.
      paint: { 'fill-color': BARVA.zelenZnacky, 'fill-opacity': 0.8 },
    },
    {
      // Zoo a zámecká zahrada. Leží v jiné zdrojové vrstvě než parky a bez
      // tohohle se nekreslily vůbec — zůstaly z nich šedé bloky uprostřed
      // města, přestože je to zeleň, kterou každý zná.
      id: 'zelene-arealy',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: jeTrida('zoo', 'theme_park', 'cemetery'),
      paint: { 'fill-color': BARVA.zelenZnacky, 'fill-opacity': 0.6 },
    },
    {
      id: 'zastavba',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: jeTrida('residential', 'suburb', 'neighbourhood'),
      paint: { 'fill-color': BARVA.zastavba, 'fill-opacity': 0.55 },
    },
    {
      id: 'prumysl',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: jeTrida('industrial', 'commercial', 'retail'),
      paint: { 'fill-color': BARVA.prumysl, 'fill-opacity': 0.7 },
    },

    // --- Domy -------------------------------------------------------------
    // Vidět začnou až zblízka. Dřív by z nich byla jen šedá kaše a právě ony
    // dělají většinu tvarů v dlaždicích.
    {
      id: 'domy',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': BARVA.zastavba,
        'fill-outline-color': BARVA.ulice,
        'fill-opacity': podleZoomu([[14, 0], [15.5, 0.85]]),
      },
    },

    // --- Vodní toky -------------------------------------------------------
    {
      id: 'potoky',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: neniTrida('river'),
      paint: { 'line-color': BARVA.potok, 'line-width': sirka([[11, 0.6], [17, 2.5]]) },
    },
    // Řeka má barvu vody, ne značky. Zelená stopa je grafický motiv webu
    // a na mapě, kde se pracuje, mate: člověk ji čte jako zeleň, ne jako tok.
    {
      id: 'reka',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: ['==', ['get', 'class'], 'river'],
      paint: {
        'line-color': BARVA.voda,
        'line-width': sirka([[11, 1.4], [17, 6]]),
      },
    },

    {
      // Kreslí se AŽ ZA toky, ne před nimi. Řeka i potok jsou čáry vedené
      // skrz rybník, a když byly navrchu, táhla se hladinou čára jako by
      // voda tekla po rybníce. Takhle je plocha překryje a vidět je jen
      // rybník.
      id: 'voda',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': BARVA.voda },
    },
    // --- Cesty a silnice --------------------------------------------------
    // Chodníky a stezky se kreslí plnou čarou. Jsou to cesty, po kterých se
    // chodí — třeba ta podél řeky ve Smetanových sadech — a čárkovaně se
    // ztrácely. Čárkovaně zůstávají jen polní a lesní pěšiny.
    //
    // Rozhoduje se podle druhu cesty a podle povrchu. Samotný povrch by
    // nestačil: v datech často chybí, takže by i chodník ve městě spadl mezi
    // nezpevněné.
    {
      id: 'cesty-zpevnene',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', jeTrida('path', 'track'), JE_ZPEVNENA],
      minzoom: 13,
      paint: {
        'line-color': BARVA.cesta,
        'line-width': sirka([[13, 0.8], [18, 3.5]]),
      },
    },
    {
      id: 'cesty-polni',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', jeTrida('path', 'track'), ['!', JE_ZPEVNENA]],
      minzoom: 14,
      paint: {
        'line-color': BARVA.cesta,
        'line-opacity': 0.75,
        'line-width': sirka([[14, 0.5], [18, 1.8]]),
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'ulice',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: jeTrida('minor', 'service'),
      paint: { 'line-color': BARVA.ulice, 'line-width': sirka([[11, 0.6], [18, 7]]) },
    },
    {
      id: 'silnice',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: jeTrida('secondary', 'tertiary'),
      paint: { 'line-color': BARVA.silnice, 'line-width': sirka([[9, 0.8], [18, 10]]) },
    },
    {
      id: 'hlavni-tahy',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: jeTrida('motorway', 'trunk', 'primary'),
      paint: { 'line-color': BARVA.hlavni, 'line-width': sirka([[7, 1], [18, 14]]) },
    },
    {
      id: 'zeleznice',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      paint: {
        'line-color': BARVA.zeleznice,
        'line-width': sirka([[11, 0.7], [18, 3]]),
        'line-dasharray': [3, 3],
      },
    },

    // --- Popisky ----------------------------------------------------------
    // Kvůli nim to celé je: obsluha na stánku hledá místo podle názvu ulice.
    //
    // Pořadí není libovolné. Když se dva popisky perou o totéž místo, vyhraje
    // ten dřívější — proto jdou názvy míst před názvy ulic. Ulic je hodně
    // a jedna se vždycky najde jinde, kdežto zoopark je jen jeden.
    {
      // Zoopark, zámecká zahrada, hřbitov. Bez názvu je z nich jen zelená
      // skvrna a člověk nepozná, na co se dívá.
      id: 'nazvy-zelene',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      // Bez `attraction` schválně: pod tu třídu spadají i jednotlivé výběhy,
      // takže se na mapě místo zooparku objevily „lamy" a „velbloudi".
      filter: jeTrida('park', 'garden', 'zoo', 'cemetery'),
      minzoom: 13,
      layout: {
        'text-field': NAZEV_MISTA,
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
        'text-anchor': 'top',
        'text-offset': [0, 0.4],
      },
      paint: {
        'text-color': BARVA.zelenZnacky,
        'text-halo-color': BARVA.pozadi,
        'text-halo-width': 1.6,
      },
    },
    {
      // Názvy větších ploch zeleně. Leží jinde než body zájmu, takže bez
      // tohohle by u některých parků nebyl název vůbec.
      id: 'nazvy-parku',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'park',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
      },
      paint: {
        'text-color': BARVA.zelenZnacky,
        'text-halo-color': BARVA.pozadi,
        'text-halo-width': 1.6,
      },
    },
    {
      id: 'nazvy-ulic',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': BARVA.popisek,
        'text-halo-color': BARVA.pozadi,
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'nazvy-mist',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: jeTrida('city', 'town', 'village', 'suburb', 'neighbourhood'),
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': podleZoomu([[10, 11], [15, 15]]),
      },
      paint: {
        'text-color': BARVA.popisek,
        'text-halo-color': BARVA.pozadi,
        'text-halo-width': 1.8,
      },
    },
    {
      id: 'nazvy-vody',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
      },
      paint: {
        'text-color': BARVA.popisekTlum,
        'text-halo-color': BARVA.pozadi,
        'text-halo-width': 1.4,
      },
    },
  ],
};
