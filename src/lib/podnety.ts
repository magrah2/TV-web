import { TEMATA, BARVA_TEMATU } from './temata';

/**
 * Kategorie podnětů sbíraných na stánku.
 *
 * Je to osm programových oblastí a k nim „Ostatní". Devátá kategorie se
 * schválně nepřidává do `TEMATA`: tím seznamem se řídí schéma programu
 * i záměrů a „Ostatní" by se tam pak dala napsat jako programová oblast,
 * což nedává smysl. Žije proto jen tady.
 */
export const OSTATNI = 'Ostatní';

export const KATEGORIE = [...TEMATA, OSTATNI] as const;

export type Kategorie = (typeof KATEGORIE)[number];

/**
 * Barva kategorie. Osm jich přebírá z programu, aby podnět měl na mapě
 * tutéž barvu jako oblast, do které patří. „Ostatní" dostává tlumenou
 * šeď — je to odkladiště, ne téma, a nemá soupeřit o pozornost.
 */
export const BARVA_KATEGORIE: Record<string, string> = {
  ...BARVA_TEMATU,
  [OSTATNI]: '#5a6c78',
};

/** Nejdelší povolený popis. Hlídá se i na serveru, tohle je jen pro formulář. */
export const NEJDELSI_POPIS = 500;
