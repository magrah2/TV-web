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
  await stranka.goto(`${ADRESA}kandidati/`, { waitUntil: 'networkidle' });

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

  // --- Podrobny program ---------------------------------------------------
  // Nejkonkretnejsi cast programu lezi na samostatnych strankach. Odkaz na ni
  // se ma objevit jen u oblasti, ktera ji ma — jinak by vedl na prazdno.
  await stranka.goto(`${ADRESA}program/`, { waitUntil: 'networkidle' });
  await stranka.waitForTimeout(300);
  const oblasti = await stranka.locator('.oblast').count();
  const sPodrobnosti = await stranka.locator('.oblast-vic a').count();
  overit('program ma odkazy na podrobnosti', true, sPodrobnosti > 0 && sPodrobnosti < oblasti);

  await stranka.locator('.oblast-vic a').first().click();
  await stranka.waitForTimeout(500);
  overit('podrobnost programu se otevre', true,
    (await stranka.locator('.detail-text').count()) === 1);
  overit('podrobnost ma vic textu nez odrazky', true,
    (await stranka.textContent('.detail-text')).length > 1500);

  // Sousedni oblast se da otevrit bez vraceni na rozcesti.
  await stranka.locator('.detail-soused').first().click();
  await stranka.waitForTimeout(500);
  overit('odkaz na sousedni oblast vede na podrobnost', true,
    (await stranka.locator('.detail-text').count()) === 1);

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

  // --- Mapy ----------------------------------------------------------------
  // Vsechny tri mapy na webu stoji na stejnem podkladu: vektorove dlazdice
  // ulozene v repozitari. Nejdulezitejsi vlastnost je, ze jsou NASE — kdyby
  // se nekdy stylu vratila adresa verejne sluzby, posilal by kazdy navstevnik
  // svoji IP adresu na cizi server a padlo by pravidlo, kvuli kteremu web
  // nepotrebuje cookie listu. Proto se u kazde mapy hlida provoz ven.
  const cizi = [];
  const chybyKonzole = [];
  stranka.on('request', (pozadavek) => {
    const kam = new URL(pozadavek.url());
    // `blob:` je vlakno, ktere si knihovna vyrobi v prohlizeci, `data:` je
    // obrazek zapsany primo v kodu. Ani jedno nikam nejde - siti jde jen
    // http a https.
    if (kam.protocol !== 'http:' && kam.protocol !== 'https:') return;
    if (kam.host !== new URL(ADRESA).host) cizi.push(kam.host);
  });
  stranka.on('console', (zprava) => {
    if (zprava.type() === 'error') chybyKonzole.push(zprava.text().slice(0, 120));
  });

  /** Poloha znacky na obrazovce. Mapu posouva knihovna, znacky jedou s ni. */
  const polohaZnacky = (selektor) =>
    stranka.$eval(selektor, (e) => e.style.transform || '');

  // --- Mapa zameru ---------------------------------------------------------
  await stranka.goto(`${ADRESA}mapa/`, { waitUntil: 'networkidle' });
  await stranka.waitForTimeout(2500);

  overit('mapa zameru nic nestahuje z ciziho serveru', 0, cizi.length);
  overit('mapa zameru nehlasi chybu', 0, chybyKonzole.length);

  // Klika se na bod, ktery stoji sam. Odznaky se nerozestrkavaji, takze
  // v centru se prekryvaji a na zakryty odznak se kliknout neda - k tem
  // vede seznam vedle mapy.
  await stranka.click('.mapa-bod[data-bod="14"]');
  await stranka.waitForTimeout(400);
  overit('klik do mapy rozbali prave jeden zamer', 1, await stranka.locator('.zamer details[open]').count());

  // Kazdy bod se musi dat otevrit ze seznamu, i ten na mape zakryty.
  const vsechnyPolozky = await stranka.locator('.zamer summary').count();
  await stranka.locator('.zamer[data-polozka="1"] summary').click();
  await stranka.waitForTimeout(400);
  overit('zakryty bod se otevre ze seznamu', 1,
    await stranka.locator('.zamer[data-polozka="1"] details[open]').count());
  overit('v seznamu jsou vsechny body', await stranka.locator('.mapa-bod').count(), vsechnyPolozky);

  const bodu = await stranka.locator('.mapa-bod').count();
  await stranka.click('.mapa-filtry .filtr[data-tema="bydleni"]');
  await stranka.waitForTimeout(300);
  const skrytych = await stranka.locator('.mapa-bod[data-skryty]').count();
  overit('filtr mapy neco skryl', true, skrytych > 0 && skrytych < bodu);
  await stranka.click('.mapa-filtry .filtr[data-tema=""]');
  await stranka.waitForTimeout(300);

  // Odznaky lezi nad mapou jako HTML a polohu jim nastavuje knihovna pres
  // `transform`. Kdyby jim ji neco prepsalo — treba vlastni zvetseni pri
  // najeti — odskocily by do rohu mapy. Uz se to jednou stalo.
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(700);
  const odznakPred = await polohaZnacky('.mapa-znacka[data-bod="1"]');
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(900);
  const odznakPo = await polohaZnacky('.mapa-znacka[data-bod="1"]');
  overit('priblizeni mapy zameru odznaky presune', true, odznakPred !== odznakPo);
  overit('odznak drzi polohu od mapy, ne vlastni', true, odznakPo.includes('translate'));

  // Vybrany bod musi zustat zvyrazneny i po odjeti mysi. Klik do mapy
  // odroluje na polozku v seznamu, mapa se pohne pod kurzorem a `mouseleave`
  // drive zvyrazneni hned zhaslo — clovek pak nevedel, co si vybral.
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(900);
  await stranka.click('.mapa-bod[data-bod="14"]');
  await stranka.waitForTimeout(800);
  await stranka.mouse.move(5, 5);
  await stranka.waitForTimeout(400);
  overit('vybrany bod zustane zvyrazneny i po odjeti mysi', 1,
    await stranka.locator('.mapa-bod.je-zvyrazneny').count());
  overit('ostatni body pri vyberu ustoupi', true,
    (await stranka.getAttribute('.mapa-plocha', 'data-zvyraznuji')) !== null);

  // --- Kde volit -----------------------------------------------------------
  // Vyhledavac rika lidem, kam maji jit volit. Kdyby ukazoval spatne, poslali
  // bychom je do nespravne mistnosti — proto se kontroluje proti udajum
  // z uredni vyhlasky mesta.
  cizi.length = 0;
  chybyKonzole.length = 0;
  await stranka.goto(`${ADRESA}kde-volit/`, { waitUntil: 'networkidle' });
  await stranka.waitForTimeout(2500);

  overit('mapa kde volit nic nestahuje z ciziho serveru', 0, cizi.length);
  overit('mapa kde volit nehlasi chybu', 0, chybyKonzole.length);

  // Plochy se sluci podle budovy, ne podle okrsku: nekolik okrsku voli
  // na stejnem miste a pro volice je to jedna oblast.
  overit('mapa ma znacku u kazde budovy', 15,
    await stranka.locator('[data-pin-budova]').count());

  // Bez JavaScriptu mapa neni, takze stranka musi odpovedet i jinak.
  // Seznam mistnosti je obycejne HTML uvnitr `<details>`.
  overit('seznam mistnosti je v HTML', 15,
    await stranka.locator('.vsechny-mistnosti li').count());

  const najdiAdresu = async (text) => {
    await stranka.fill('[data-vstup]', '');
    await stranka.fill('[data-vstup]', text);
    await stranka.waitForTimeout(800);
    if (!(await stranka.locator('.navrhy li').count())) return null;
    await stranka.locator('.navrhy li').first().click();
    await stranka.waitForTimeout(900);
    return (await stranka.textContent('.karta-misto')).trim();
  };

  // Podle vyhlasky mesta: Dukelska 2 patri do okrsku 2, ten voli v knihovne.
  overit('Dukelska 2 -> knihovna', true, (await najdiAdresu('Dukelská 2') ?? '').includes('Knihovna'));

  // Vyhledavac musi zvladnout i zapis bez mezery.
  overit('funguje i bez mezery', true, (await najdiAdresu('dukelska2') ?? '').includes('Knihovna'));

  // Cislo popisne i orientacni — clovek zna svuj dum podle jednoho z nich.
  overit('najde i podle druheho cisla', true, (await najdiAdresu('Slovanská 111') ?? '').length > 0);

  // Mistni casti maji vlastni mistnost primo v obci a nemaji nazev ulice.
  overit('Lhota voli v Sokole ve Lhote', true, (await najdiAdresu('Lhota 8') ?? '').includes('Sokol Lhota'));

  overit('nalezena adresa zvyrazni prave jednu oblast', 1,
    await stranka.locator('[data-pin-budova][data-vybrany]').count());
  overit('nalezena adresa se ukaze na mape', true, await stranka.locator('[data-moje]').isVisible());
  overit('do mapy se vypise cil', true, await stranka.locator('[data-popis-cile]').isVisible());
  overit('do mapy se vypise adresa', true, await stranka.locator('[data-popis-adresy]').isVisible());
  overit('vede se spojnice', 'ano', await stranka.getAttribute('[data-mapa]', 'data-cesta'));

  // Klik do mapy je druha cesta ke stejne odpovedi. Znacky mistnosti musi
  // byt klikaci: plochy oblasti se u sebe prekryvaji, takze klik vedle
  // znacky casto vybere sousedni oblast.
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(1200);
  await stranka.click('.budova-pin[title*="Morávkova"]');
  await stranka.waitForTimeout(800);
  overit('klik na znacku mistnosti vybere jeji oblast', true,
    (await stranka.textContent('.karta-misto')).includes('Morávkova'));

  // A klik do plochy taky — tam uz staci, ze vybere nejakou.
  const stredMapy = await stranka.evaluate(() => {
    const r = document.querySelector('[data-mapa]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await stranka.mouse.click(stredMapy.x, stredMapy.y);
  await stranka.waitForTimeout(800);
  overit('klik do plochy vybere oblast', 1,
    await stranka.locator('[data-pin-budova][data-vybrany]').count());

  // Mapa musi jit priblizit a znacky musi jet s ni.
  const znackaPred = await polohaZnacky('[data-pin-budova="0"]');
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(900);
  overit('priblizeni mapy kde volit presune znacky', true,
    znackaPred !== (await polohaZnacky('[data-pin-budova="0"]')));


  await stranka.fill('[data-vstup]', '');
  await stranka.fill('[data-vstup]', 'Neexistujici ulice 999');
  await stranka.waitForTimeout(800);
  overit('nesmyslna adresa neco rekne', true,
    (await stranka.textContent('[data-stav]')).trim().length > 0);
} finally {
  await stranka.close();
  await prohlizec.close();
}

console.log(chyb ? `\n${CERVENA}${chyb} CHYB${KONEC}` : `\n${ZELENA}Vse proslo.${KONEC}`);
process.exit(chyb ? 1 : 0);
