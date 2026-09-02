import vyrez from './mapa-vyrez.json';

/**
 * Přepočet zeměpisných souřadnic na polohu v podkladové mapě.
 *
 * Body záměrů jsou v datech uložené jako `lat` a `lon`, ne jako procenta.
 * Je to schválně: procenta platí jen pro jeden konkrétní výřez mapy, takže
 * kdyby se výřez změnil (třeba oddálil), všech jedenáct bodů by se rozjelo
 * a musely by se přepisovat ručně. Takhle se přepočítají samy.
 *
 * Výřez i rozměr mapy zapisuje generátor `nastroje/mapa.mjs` do
 * `mapa-vyrez.json`, takže obojí vychází z jednoho zdroje.
 */

/** Mercatorova projekce — stejná, jakou používá generátor mapy. */
const merkator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

const yJih = merkator(vyrez.jih);
const MERITKO = vyrez.sirka / (vyrez.vychod - vyrez.zapad);

/**
 * Rozměr podkladu v jednotkách SVG — tedy jeho `viewBox`.
 *
 * Mapa se na webu zvětšuje `viewBox`em, takže tohle je zároveň nejmenší
 * možné přiblížení. Zapisuje to generátor, aby existoval jeden zdroj pravdy.
 */
export const ROZMER = { sirka: vyrez.sirka, vyska: vyrez.vyska };

/** Vrátí polohu v procentech šířky a výšky podkladu. */
export function naMape(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - vyrez.zapad) * MERITKO) / vyrez.sirka;
  const y = (vyrez.vyska - (merkator(lat) - yJih) * (180 / Math.PI) * MERITKO) / vyrez.vyska;
  return {
    x: Math.round(x * 1000) / 10,
    y: Math.round(y * 1000) / 10,
  };
}

/** Leží bod uvnitř výřezu? Když ne, na mapu by se nevešel. */
export function jeVeVyrezu(lat: number, lon: number): boolean {
  return lat >= vyrez.jih && lat <= vyrez.sever && lon >= vyrez.zapad && lon <= vyrez.vychod;
}
