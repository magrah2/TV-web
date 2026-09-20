/**
 * Programové oblasti — jediný seznam, ze kterého čerpá všechno ostatní:
 * schéma programu a záměrů, filtry a štítky u bodů na mapě.
 *
 * Když se sem něco přidá, objeví se to všude. Když se u záměru nebo
 * programové oblasti napíše téma, které tady není, Astro shodí sestavení
 * a chyba se nedostane na web.
 */

export const TEMATA = [
  'Hospodaření',
  'Bydlení',
  'Zeleň a voda',
  'Doprava',
  'Školství',
  'Kultura',
  'Podnikání',
  'Bezpečnost',
] as const;

export type Tema = (typeof TEMATA)[number];

/**
 * Barva, kterou se téma značí na mapě a ve štítcích.
 *
 * Původně to byly jen odstíny modré a zelené z loga. Vypadalo to klidně,
 * jenže osm oblastí se do dvou barev nevejde: na mapě záměrů z toho byla
 * kolečka „modré a zelené" a poznat podle nich kategorii nešlo. Dvě z nich
 * byly navíc tak tmavé, že na tmavé mapě zanikly úplně.
 *
 * Paleta je proto širší, ale ne libovolná — modrá a zelená ze značky zůstávají
 * páteří a zbytek jsou tytéž odstíny, jakými se na mapě „kde volit" rozlišují
 * volební oblasti. Web tak má jednu sadu barev, ne dvě.
 *
 * Nejvýraznější odstíny dostala témata, která mají záměry na mapě — tam se
 * barvy potkávají vedle sebe a musí jít rozlišit. Hospodaření a školství
 * zatím žádný záměr nemají, takže je vidět jen na dlaždicích programu.
 */
export const BARVA_TEMATU: Record<Tema, string> = {
  'Hospodaření': '#1d6eb0',
  'Bydlení': '#e8a83c',
  'Zeleň a voda': '#5bae39',
  'Doprava': '#2b8ac9',
  'Školství': '#e07ba2',
  'Kultura': '#a08ff0',
  'Podnikání': '#2ec6d8',
  'Bezpečnost': '#b7cf3e',
};

/** Adresní tvar tématu pro filtrování přes URL: „Zeleň a voda" → „zelen-a-voda" */
export function temaDoAdresy(tema: string): string {
  return tema
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Politická příslušnost — uvádí se na kandidátní listině, takže ji
    ukazujeme dobrovolně i na webu. */
export const PRISLUSNOSTI = [
  'nezávislý kandidát',
  'nezávislá kandidátka',
  'Strana zelených',
  'Česká pirátská strana',
] as const;
