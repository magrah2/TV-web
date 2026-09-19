import vyrez from './mapa-vyrez-obec.json';

/**
 * Přepočet mezi zeměpisnými souřadnicemi a polohou v mapě celé obce.
 *
 * Proti `mapa.ts` jsou tu dva rozdíly. Za prvé jde o výřez celé obce, ne
 * jen města — sběr podnětů musí pokrýt i Rychtářov, Lhotu nebo Opatovice.
 * Za druhé se počítá i **opačným směrem**: při sběru člověk ťukne do mapy
 * a z té polohy se musí stát zeměpisná souřadnice, aby bod přežil změnu
 * výřezu stejně jako body záměrů.
 *
 * Vrací se jednotky SVG, ne procenta. Při ťuknutí se pracuje přímo
 * s `viewBox`em, takže by se procenta stejně hned násobila zpátky.
 */

/** Mercatorova projekce — stejná, jakou používá generátor mapy. */
const merkator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

/** Opačný směr k `merkator`. */
const zMerkatoru = (y: number) => 2 * Math.atan(Math.exp(y)) - Math.PI / 2;

const NA_STUPNE = 180 / Math.PI;
const yJih = merkator(vyrez.jih);
const MERITKO = vyrez.sirka / (vyrez.vychod - vyrez.zapad);

/** Rozměr podkladu v jednotkách SVG, tedy jeho výchozí `viewBox`. */
export const ROZMER_OBCE = { sirka: vyrez.sirka, vyska: vyrez.vyska };

export const VYREZ_OBCE = vyrez;

/** Zeměpisná poloha → poloha v mapě. */
export function naMapuObce(lat: number, lon: number): { x: number; y: number } {
  return {
    x: (lon - vyrez.zapad) * MERITKO,
    y: vyrez.vyska - (merkator(lat) - yJih) * NA_STUPNE * MERITKO,
  };
}

/** Poloha v mapě → zeměpisná poloha. */
export function zMapyObce(x: number, y: number): { lat: number; lon: number } {
  const lon = vyrez.zapad + x / MERITKO;
  const lat = zMerkatoru(yJih + (vyrez.vyska - y) / (MERITKO * NA_STUPNE)) * NA_STUPNE;
  return { lat, lon };
}

/** Leží bod uvnitř výřezu? Když ne, na mapu by se nevešel. */
export function jeVeVyrezuObce(lat: number, lon: number): boolean {
  return lat >= vyrez.jih && lat <= vyrez.sever && lon >= vyrez.zapad && lon <= vyrez.vychod;
}
