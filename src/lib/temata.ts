/**
 * Programové oblasti — jediný seznam, ze kterého čerpá všechno ostatní:
 * schéma kandidátů, filtry na kandidátce, štítky u bodů na mapě.
 *
 * Když se sem něco přidá, objeví se to všude. Když se u kandidáta napíše
 * téma, které tady není, Astro shodí sestavení a chyba se nedostane na web.
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

/** Barva, kterou se téma značí na mapě a ve štítcích. Odstíny modré a zelené
    z loga — nic mimo značkovou paletu, jinak se web rozsype do duhy. */
export const BARVA_TEMATU: Record<Tema, string> = {
  'Hospodaření': '#1d6eb0',
  'Bydlení': '#2b8ac9',
  'Zeleň a voda': '#5bae39',
  'Doprava': '#0e4d80',
  'Školství': '#3f9bd4',
  'Kultura': '#7cc45f',
  'Podnikání': '#145286',
  'Bezpečnost': '#4a9e7e',
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
