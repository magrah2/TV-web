/**
 * Vyrez uzemi obce a jeho prepocet na souradnice mapy.
 *
 * Pouzivaji to dva skripty a musi se shodnout:
 *
 *   dlazdice.mjs  stahuje vektorove dlazdice prave pro tenhle vyrez
 *   okrsky.mjs    v nem rastruje plochy volebnich oblasti
 *
 * Driv to byl soubor `src/lib/mapa-vyrez-obec.json`, ktery zapisoval
 * generator SVG podkladu. Ten uz neexistuje - mapa se sklada z dlazdic -
 * takze vyrez ziji tady, kde se k nemu da napsat, proc je takovy.
 */

/**
 * Cele uzemi obce vcetne Rychtarova, Lhoty a Opatovic.
 *
 * Musi v nem byt uplne vsechny okrsky, jinak by nekteri lide svuj na mape
 * nenasli.
 */
export const VYREZ_OBCE = { jih: 49.2542, sever: 49.3388, zapad: 16.8995, vychod: 17.0327 };

/**
 * Sirka mrizky v jednotkach mapy.
 *
 * Je to jen vnitrni meritko pro rastrovani ploch okrsku: cim vetsi cislo,
 * tim jemneji se plochy trasuji. Na web se z nej nic nedostane, protoze
 * hotove plochy jsou v zemepisnych souradnicich.
 */
export const SIRKA = 1000;

/** Mercator - stejna projekce, jakou pouziva mapa v prohlizeci. */
export const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

const yJih = merkator(VYREZ_OBCE.jih);

/** Kolik jednotek mapy pripada na jeden stupen zemepisne delky. */
export const MERITKO = SIRKA / (VYREZ_OBCE.vychod - VYREZ_OBCE.zapad);

/** Vyska mrizky. Dopocitava se, aby mesto nevypadalo natazene na vysku. */
export const VYSKA = Math.round((merkator(VYREZ_OBCE.sever) - yJih) * (180 / Math.PI) * MERITKO);

export const VYREZ = { ...VYREZ_OBCE, sirka: SIRKA, vyska: VYSKA };
