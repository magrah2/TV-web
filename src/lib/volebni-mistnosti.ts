/**
 * Volební místnosti ve Vyškově pro volby 9.–10. října 2026.
 *
 * Přepsáno z úřední vyhlášky města „Informace pro voliče o době a místě konání
 * voleb do Zastupitelstva města Vyškova a Senátu Parlamentu České republiky",
 * vydané Městským úřadem Vyškov podle § 5 odst. 1 zákona č. 88/2024 Sb.,
 * o správě voleb.
 *
 * Přiřazení adres k okrskům se sem NEOPISUJE — to si web bere z otevřených dat
 * ČÚZK (RÚIAN), kde je každá adresa v obci uvedená i s číslem okrsku.
 * Ručně se udržuje jen tenhle seznam místností, protože ten v otevřených
 * datech není.
 *
 * POZOR: platí pro konkrétní volby. Před dalšími volbami se musí ověřit znovu —
 * místnosti se mezi volbami mění.
 */

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

export const VOLEBNI_MISTNOSTI: VolebniMistnost[] = [
  { okrsek: 1, nazev: 'Knihovna Karla Dvořáčka', adresa: 'Nádražní 4', bezbarierovy: true },
  { okrsek: 2, nazev: 'Knihovna Karla Dvořáčka', adresa: 'Nádražní 4', bezbarierovy: true },
  { okrsek: 3, nazev: 'Knihovna Karla Dvořáčka', adresa: 'Nádražní 4', bezbarierovy: true },
  { okrsek: 4, nazev: 'Základní škola Vyškov', adresa: 'Nádražní 5', bezbarierovy: false },
  { okrsek: 5, nazev: 'Základní škola Vyškov', adresa: 'Na Vyhlídce 12', bezbarierovy: true },
  { okrsek: 6, nazev: 'Základní škola Vyškov', adresa: 'Tyršova 4', bezbarierovy: true },
  { okrsek: 7, nazev: 'Základní škola Vyškov', adresa: 'Na Vyhlídce 12', bezbarierovy: true },
  { okrsek: 8, nazev: 'Základní škola Vyškov', adresa: 'Tyršova 4', bezbarierovy: true },
  { okrsek: 9, nazev: 'Základní škola Vyškov', adresa: 'Tyršova 4', bezbarierovy: true },
  { okrsek: 10, nazev: 'Základní škola Vyškov', adresa: 'Tyršova 4', bezbarierovy: true },
  { okrsek: 11, nazev: 'Polní 5', adresa: 'Polní 5', bezbarierovy: false, poznamka: 'bývalá Pečovatelská služba' },
  { okrsek: 12, nazev: 'Lípová 2', adresa: 'Lípová 2', bezbarierovy: true, poznamka: 'bývalá Veřejně správní akademie' },
  { okrsek: 13, nazev: 'Základní škola Vyškov', adresa: 'Purkyňova 39', bezbarierovy: true },
  { okrsek: 14, nazev: 'Základní škola Vyškov', adresa: 'Purkyňova 39', bezbarierovy: true },
  { okrsek: 15, nazev: 'Základní škola Vyškov', adresa: 'Purkyňova 39', bezbarierovy: true },
  { okrsek: 16, nazev: 'Hasičský záchranný sbor Vyškov', adresa: 'Hasičská 2', bezbarierovy: false },
  { okrsek: 17, nazev: 'Základní škola Vyškov', adresa: 'Purkyňova 39', bezbarierovy: true },
  { okrsek: 18, nazev: 'Katolický dům Dědice', adresa: 'Dědická 104/130', bezbarierovy: false },
  { okrsek: 19, nazev: 'Katolický dům Dědice', adresa: 'Dědická 104/130', bezbarierovy: false },
  { okrsek: 20, nazev: 'Základní škola Vyškov', adresa: 'Morávkova 40', bezbarierovy: false },
  {
    okrsek: 21,
    nazev: 'Základní škola a Mateřská škola Vyškov, Letní pole',
    adresa: 'Sídliště Osvobození 682/56',
    bezbarierovy: true,
  },
  {
    okrsek: 22,
    nazev: 'Základní škola a Mateřská škola Vyškov, Letní pole',
    adresa: 'Sídliště Osvobození 682/56',
    bezbarierovy: true,
  },
  { okrsek: 23, nazev: 'Mateřská škola Opatovice', adresa: 'Opatovice 108', bezbarierovy: false },
  { okrsek: 24, nazev: 'Kulturní dům Rychtářov', adresa: 'Rychtářov 104', bezbarierovy: false },
  { okrsek: 25, nazev: 'Tělocvičná jednota Sokol Lhota', adresa: 'Lhota 88', bezbarierovy: false },
  {
    okrsek: 26,
    nazev: 'Slovanská 111, Hamiltony',
    adresa: 'Slovanská 111',
    bezbarierovy: true,
    poznamka: 'bývalá požární zbrojnice',
  },
];

/** Kdy se volí. Z téže vyhlášky. */
export const VOLEBNI_DNY = [
  { den: 'pátek', datum: '9. října 2026', od: '14:00', do: '22:00' },
  { den: 'sobota', datum: '10. října 2026', od: '8:00', do: '14:00' },
];

/**
 * Ve stejném termínu se ve Vyškově volí i do Senátu. Web je o komunálních
 * volbách, ale volič dostane oboje najednou — a když to nikdo nezmíní,
 * překvapí ho to až ve volební místnosti.
 */
export const SOUBEZNE_VOLBY = {
  nazev: 'Senát Parlamentu České republiky',
  druheKolo: { od: '16. října 2026', do: '17. října 2026' },
};
