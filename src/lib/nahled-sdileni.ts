import karty from './nahledy-sdileni.json';

/**
 * Obrázek, který se ukáže, když někdo stránku sdílí.
 *
 * Když někdo hodí odkaz do Messengeru, na Facebook nebo na Instagram, síť si
 * stránku stáhne a hledá v ní obrázek. Bez něj ukáže holý odkaz — a ten na
 * sociálních sítích nikdo neotevře.
 *
 * Karty vyrábí `nastroje/nahledy-sdileni.mjs` a leží v `public/nahledy/`.
 * Seznam vyrobených karet zapisuje týž skript, takže se nemůže stát, že by
 * se tu odkazovalo na obrázek, který neexistuje.
 */

/** Stránky, které vlastní kartu nemají, dostanou tuhle. */
const VYCHOZI = 'vychozi';

/**
 * Z adresy stránky vybere název karty.
 *
 * Hledá se od nejpodrobnějšího k nejobecnějšímu: nejdřív celá cesta
 * (`/kde-volit/`), pak její první část (`/kandidati/#nekdo` → `kandidati`).
 * Medailonek kandidáta tak zdědí kartu kandidátky a nemusí mít vlastní.
 */
export function nahledSdileni(cesta: string): string {
  // Na draftu běží web v podsložce `/TV-web/`, takže adresa začíná jí.
  // Bez odstranění by se první částí cesty stal název podsložky a všechny
  // stránky by dostaly výchozí kartu.
  const zaklad = import.meta.env.BASE_URL;
  const bezZakladu = cesta.startsWith(zaklad) ? cesta.slice(zaklad.length) : cesta;
  const casti = bezZakladu.split('/').filter(Boolean);

  if (!casti.length) return karty.includes('uvod') ? 'uvod' : VYCHOZI;

  const cela = casti.join('-');
  if (karty.includes(cela)) return cela;
  if (karty.includes(casti[0])) return casti[0];
  return VYCHOZI;
}
