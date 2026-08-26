/**
 * Volební místnosti — typovaná nadstavba nad `volebni-mistnosti.json`.
 *
 * Data jsou schválně v JSON, a ne přímo tady: kromě webu je čte i generátor
 * map (`nastroje/okrsky.mjs`), který podle nich slučuje okrsky volící ve
 * stejné budově. Kdyby to byl TypeScript, generátor by si ho nepřečetl.
 *
 * Údaje pocházejí z úřední vyhlášky města. Před dalšími volbami se musí
 * ověřit znovu — místnosti se mezi volbami mění.
 */

import zdroj from './volebni-mistnosti.json';

export interface VolebniMistnost {
  /** Číslo volebního okrsku podle vyhlášky i podle dat ČÚZK. */
  okrsek: number;
  /** Název místa tak, jak ho zná místní — „Knihovna Karla Dvořáčka". */
  nazev: string;
  /** Adresa, podle které se místo hledá a dohledávají se souřadnice. */
  adresa: string;
  /** Uvádí vyhláška u tohohle okrsku bezbariérový přístup? */
  bezbarierovy: boolean;
  /** Doplněk, který vyhláška uvádí v závorce. */
  poznamka?: string;
}

export const VOLEBNI_MISTNOSTI: VolebniMistnost[] = zdroj.mistnosti;

/** Kdy se volí. Z téže vyhlášky. */
export const VOLEBNI_DNY = zdroj.dny;

/**
 * Ve stejném termínu se ve Vyškově volí i do Senátu. Web je o komunálních
 * volbách, ale volič dostane oboje najednou — a když to nikdo nezmíní,
 * překvapí ho to až ve volební místnosti.
 */
export const SOUBEZNE_VOLBY = zdroj.soubezneVolby;

/** Klíč budovy — okrsky se stejným klíčem volí na stejném místě. */
export const klicBudovy = (m: { nazev: string; adresa: string }) => `${m.nazev}|${m.adresa}`;
