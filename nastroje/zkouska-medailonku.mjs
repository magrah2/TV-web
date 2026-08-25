/**
 * Zkouska chovani medailonku na strance /lide/.
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

const ADRESA = process.env.ADRESA ?? 'http://localhost:4321/TP-web/';

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
} finally {
  await stranka.close();
  await prohlizec.close();
}

console.log(chyb ? `\n${CERVENA}${chyb} CHYB${KONEC}` : `\n${ZELENA}Vse proslo.${KONEC}`);
process.exit(chyb ? 1 : 0);
