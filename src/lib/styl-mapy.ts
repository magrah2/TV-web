import tokeny from '../styles/tokeny.css?raw';

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
  reka: token('zelena'),
  popisek: token('na-noci'),
  popisekTlum: token('na-noci-tlum'),
};

const ZDROJ = 'https://tiles.openfreemap.org/planet';
const PISMA = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

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

/** Filtr „třída není…" */
function neniTrida(trida: string) {
  return ['!=', ['get', 'class'], trida];
}

export const STYL_MAPY = {
  version: 8,
  glyphs: PISMA,
  sources: {
    openmaptiles: { type: 'vector', url: ZDROJ },
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
      paint: { 'fill-color': BARVA.zelen, 'fill-opacity': 0.5 },
    },
    {
      id: 'parky',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': BARVA.zelen, 'fill-opacity': 0.7 },
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
    {
      id: 'voda',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': BARVA.voda },
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
    // Řeka je zelená stejně jako na ostatních mapách webu — je to tatáž Haná.
    {
      id: 'reka',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: ['==', ['get', 'class'], 'river'],
      paint: {
        'line-color': BARVA.reka,
        'line-opacity': 0.75,
        'line-width': sirka([[11, 1.2], [17, 5]]),
      },
    },

    // --- Cesty a silnice --------------------------------------------------
    {
      id: 'pesiny',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: jeTrida('path', 'track'),
      minzoom: 13,
      paint: {
        'line-color': BARVA.cesta,
        'line-width': sirka([[13, 0.5], [18, 2]]),
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
