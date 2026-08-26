/**
 * Zkouska interaktivnich casti webu: medailonky, filtry, volebni listek a mapa.
 *
 *   npm run zkouska
 *
 * Medailonek je jedina cast webu, ktera si drzi stav a saha do historie
 * prohlizece — a uz jednou se kvuli tomu rozbila: po preskakovani mezi lidmi
 * sel panel zavrit krizkem ani Escapem, protoze kazdy skok pridal zaznam
 * do historie a "zavrit" pak znamenalo "vrat se k predchozimu cloveku".
 *
 * Tahle zkouska hlida, aby se to nevratilo. Potrebuje nainstalovany
 * Microsoft Edge nebo Chrome — zadny prohlizec se nestahuje.
 *
 * Pozor: pred spustenim musi bezet nahled (`npm run nahled`) nebo
 * sestaveny web (`npm run sestavit` a `npm run preview`).
 */

import { chromium } from 'playwright-core';

const ADRESA = process.env.ADRESA ?? 'http://localhost:4321/TV-web/';

const ZELENA = '\x1b[32m';
const CERVENA = '\x1b[31m';
const KONEC = '\x1b[0m';

let chyb = 0;

function overit(popis, cekano, dostal) {
  const ok = cekano === dostal;
  if (!ok) chyb++;
  const znacka = ok ? `${ZELENA}OK   ${KONEC}` : `${CERVENA}CHYBA${KONEC}`;
  console.log(`${znacka} ${popis}${ok ? '' : `  (cekano: ${cekano}, dostal: ${dostal})`}`);
}

/** Spusti prvni prohlizec, ktery je na pocitaci k dispozici. */
async function spustProhlizec() {
  for (const kanal of ['msedge', 'chrome', 'chromium']) {
    try {
      return await chromium.launch({ channel: kanal });
    } catch {
      // zkusime dalsi
    }
  }
  console.log(`${CERVENA}Nenasel jsem Edge ani Chrome. Zkousku nelze spustit.${KONEC}`);
  process.exit(1);
}

const prohlizec = await spustProhlizec();
const stranka = await prohlizec.newPage({ viewport: { width: 1440, height: 900 } });

/** Vrati id otevreneho medailonku, nebo null kdyz je zavreny. */
const otevreny = () =>
  stranka.evaluate(() => document.querySelector('.medailonek.je-otevreny')?.id ?? null);

const skokVpred = async () => {
  await stranka.click('.medailonek.je-otevreny .medailonek-sousede a:last-child');
  await stranka.waitForTimeout(200);
};
const skokVzad = async () => {
  await stranka.click('.medailonek.je-otevreny .medailonek-sousede a:first-child');
  await stranka.waitForTimeout(200);
};

try {
  await stranka.goto(`${ADRESA}lide/`, { waitUntil: 'networkidle' });

  // --- Otevreni a preskakovani -------------------------------------------
  await stranka.click('[data-medailonek="3"]');
  await stranka.waitForTimeout(200);
  overit('otevreni z mrizky', 'medailonek-3', await otevreny());

  await skokVpred();
  await skokVpred();
  await skokVpred();
  overit('tri skoky doprava', 'medailonek-6', await otevreny());

  // --- Zavirani po preskakovani (to, co bylo rozbite) ---------------------
  await stranka.keyboard.press('Escape');
  await stranka.waitForTimeout(300);
  overit('Escape po skakani zavre', null, await otevreny());

  await stranka.click('[data-medailonek="10"]');
  await stranka.waitForTimeout(200);
  await skokVpred();
  await skokVpred();
  await stranka.click('.medailonek.je-otevreny [data-zavrit]');
  await stranka.waitForTimeout(300);
  overit('krizek po skakani zavre', null, await otevreny());

  await stranka.click('[data-medailonek="20"]');
  await stranka.waitForTimeout(200);
  await skokVzad();
  await skokVzad();
  await skokVzad();
  overit('tri skoky doleva', 'medailonek-17', await otevreny());

  await stranka.click('.medailonek.je-otevreny .medailonek-podklad', { position: { x: 20, y: 20 } });
  await stranka.waitForTimeout(300);
  overit('podklad po skakani zavre', null, await otevreny());

  // --- Zpetne tlacitko prohlizece ----------------------------------------
  await stranka.click('[data-medailonek="7"]');
  await stranka.waitForTimeout(200);
  await stranka.goBack();
  await stranka.waitForTimeout(300);
  overit('zpetne tlacitko zavre', null, await otevreny());

  // --- Prichod rovnou s kotvou z uvodni stranky --------------------------
  await stranka.goto(ADRESA, { waitUntil: 'networkidle' });
  await stranka.click('.lide-mrizka [data-medailonek="2"]');
  await stranka.waitForLoadState('networkidle');
  await stranka.waitForTimeout(350);
  overit('prichod z uvodni stranky', 'medailonek-2', await otevreny());

  await skokVpred();
  await stranka.keyboard.press('Escape');
  await stranka.waitForTimeout(300);
  overit('Escape po prichodu s kotvou', null, await otevreny());

  // --- Filtry -------------------------------------------------------------
  await stranka.goto(`${ADRESA}lide/`, { waitUntil: 'networkidle' });
  await stranka.click('.filtr[data-hodnota="skolstvi"]');
  await stranka.waitForTimeout(250);
  const videno = await stranka.evaluate(
    () => document.querySelectorAll('.karta-kandidata:not([data-skryta])').length,
  );
  const vsech = await stranka.evaluate(() => document.querySelectorAll('.karta-kandidata').length);
  overit('filtr neco odfiltroval', true, videno > 0 && videno < vsech);
  overit('filtr se propsal do adresy', true, stranka.url().includes('tema=skolstvi'));

  // --- Volebni listek -----------------------------------------------------
  // Tohle pocita, komu pripadne hlas. Kdyby to pocitalo spatne, ucili bychom
  // lidi volit spatne - proto se kazde pravidlo hlida zvlast.
  await stranka.goto(`${ADRESA}jak-volit/`, { waitUntil: 'networkidle' });

  const vynuluj = () => stranka.click('[data-reset]');
  const hlasu = () => stranka.locator('.radek[data-hlas]').count();
  const ignorovanych = () => stranka.locator('.radek[data-ignorovany]').count();
  const jeNeplatny = async () => (await stranka.locator('[data-listek][data-neplatny]').count()) > 0;
  const oznac = async (klice) => {
    for (const k of klice) await stranka.click(`[data-kandidat="${k}"]`);
  };

  await vynuluj();
  await stranka.click('[data-strana-ramecek="tv"]');
  await stranka.waitForTimeout(200);
  overit('jen strana = 27 hlasu', 27, await hlasu());

  await vynuluj();
  await oznac(['tv:0', 'tv:5', 'ukazka-a:2', 'ukazka-b:0', 'ukazka-b:9']);
  await stranka.waitForTimeout(200);
  overit('jen jednotlivci = 5 hlasu', 5, await hlasu());
  overit('jen jednotlivci = zbyva 22', '22', await stranka.textContent('[data-zbyva]'));

  // Zakon rika, ze krizky u lidi z oznacene strany se ignoruji.
  await vynuluj();
  await stranka.click('[data-strana-ramecek="tv"]');
  await oznac(['tv:24', 'tv:25', 'tv:26']);
  await stranka.waitForTimeout(200);
  overit('strana + vlastni lide = porad 27 hlasu', 27, await hlasu());
  overit('strana + vlastni lide = 3 ignorovane', 3, await ignorovanych());
  overit('strana + vlastni lide je platny', false, await jeNeplatny());

  // Kombinace: jednotlivci z jinych stran se pocitaji prvni, zbytek jde strane odshora.
  await vynuluj();
  await stranka.click('[data-strana-ramecek="tv"]');
  await oznac(['ukazka-a:0', 'ukazka-a:1', 'ukazka-b:0', 'ukazka-b:1']);
  await stranka.waitForTimeout(200);
  overit('kombinace = 27 hlasu celkem', 27, await hlasu());
  overit(
    'kombinace rozdeli 4 + 23',
    true,
    (await stranka.textContent('[data-vysledek-detail]')).includes('1 až 23'),
  );

  await vynuluj();
  await stranka.click('[data-strana-ramecek="tv"]');
  await stranka.click('[data-strana-ramecek="ukazka-a"]');
  await stranka.waitForTimeout(200);
  overit('dve strany = neplatny', true, await jeNeplatny());

  await vynuluj();
  for (let i = 0; i < 27; i++) await stranka.click(`[data-kandidat="tv:${i}"]`);
  await stranka.waitForTimeout(200);
  overit('presne 27 jednotlivcu je platny', false, await jeNeplatny());
  await stranka.click('[data-kandidat="ukazka-a:0"]');
  await stranka.waitForTimeout(200);
  overit('28 jednotlivcu = neplatny', true, await jeNeplatny());

  // --- Mapa zameru ---------------------------------------------------------
  await stranka.goto(`${ADRESA}mapa/`, { waitUntil: 'networkidle' });
  await stranka.waitForTimeout(300);
  await stranka.click('.mapa-bod[data-bod="2"]');
  await stranka.waitForTimeout(400);
  overit('klik do mapy rozbali prave jeden zamer', 1, await stranka.locator('.zamer details[open]').count());

  const bodu = await stranka.locator('.mapa-bod').count();
  await stranka.click('.mapa-filtry .filtr[data-tema="bydleni"]');
  await stranka.waitForTimeout(300);
  const skrytych = await stranka.locator('.mapa-bod[data-skryty]').count();
  overit('filtr mapy neco skryl', true, skrytych > 0 && skrytych < bodu);
} finally {
  await stranka.close();
  await prohlizec.close();
}

console.log(chyb ? `\n${CERVENA}${chyb} CHYB${KONEC}` : `\n${ZELENA}Vse proslo.${KONEC}`);
process.exit(chyb ? 1 : 0);
