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

/** Poměr stran mapy — potřeba, aby se vodorovná a svislá procenta
    dala porovnávat, když je mapa širší než vyšší. */
const POMER = vyrez.vyska / vyrez.sirka;

/**
 * Rozestrká body, které by se na mapě překrývaly.
 *
 * Půlka záměrů leží v historickém centru, kde je od sebe pár set metrů —
 * na mapě celého města to znamená pár pixelů a odznaky se slepí do nečitelné
 * hromady, na kterou se nedá pořádně kliknout.
 *
 * Posun je proto **omezený** (`maxPosun`): odznak se smí odsunout jen tak,
 * aby pořád ukazoval na správné místo. Mapa je schematická, ne katastrální.
 */
export function rozestrciBody<T extends { x: number; y: number }>(
  body: T[],
  { minVzdalenost = 4.8, maxPosun = 3.4, kroku = 120 } = {},
): T[] {
  // Pracujeme v soustavě, kde 1 jednotka = 1 % šířky mapy, aby svislý
  // a vodorovný odstup odpovídaly stejné vzdálenosti na obrazovce.
  const stav = body.map((b) => ({ puvodX: b.x, puvodY: b.y * POMER, x: b.x, y: b.y * POMER }));

  for (let krok = 0; krok < kroku; krok++) {
    let hnulSe = false;

    for (let i = 0; i < stav.length; i++) {
      for (let j = i + 1; j < stav.length; j++) {
        const a = stav[i];
        const b = stav[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let vzdalenost = Math.hypot(dx, dy);

        if (vzdalenost >= minVzdalenost) continue;

        // Dva body přesně na sobě nemají směr, kterým je rozstrčit.
        // Rozhodne pořadí, aby výsledek vyšel při každém sestavení stejně.
        if (vzdalenost < 0.001) {
          dx = (i % 2 === 0 ? 1 : -1) * 0.01;
          dy = 0.01;
          vzdalenost = Math.hypot(dx, dy);
        }

        const posun = (minVzdalenost - vzdalenost) / 2;
        const jx = (dx / vzdalenost) * posun;
        const jy = (dy / vzdalenost) * posun;

        a.x -= jx;
        a.y -= jy;
        b.x += jx;
        b.y += jy;
        hnulSe = true;
      }
    }

    // Nikdo se nesmí vzdálit od svého skutečného místa víc, než je dovoleno.
    for (const s of stav) {
      const dx = s.x - s.puvodX;
      const dy = s.y - s.puvodY;
      const vzdalenost = Math.hypot(dx, dy);
      if (vzdalenost > maxPosun) {
        s.x = s.puvodX + (dx / vzdalenost) * maxPosun;
        s.y = s.puvodY + (dy / vzdalenost) * maxPosun;
      }
    }

    if (!hnulSe) break;
  }

  return body.map((b, i) => ({
    ...b,
    x: Math.round(Math.min(98, Math.max(2, stav[i].x)) * 10) / 10,
    y: Math.round(Math.min(98, Math.max(2, stav[i].y / POMER)) * 10) / 10,
  }));
}
