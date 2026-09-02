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

  // Mapa se musi zvetsovat `viewBox`em. Se `transform: scale()` si prohlizec
  // SVG jednou vykresli do bitmapy a tu pak natahuje — z priblizene mapy jsou
  // kosticky. Stejna chyba uz tu byla dvakrat, u teto mapy i u "kde volit".
  const vyrezPred = await stranka.getAttribute('.mapa-plocha svg', 'viewBox');
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(400);
  overit('priblizeni mapy zameru meni viewBox', true,
    vyrezPred !== (await stranka.getAttribute('.mapa-plocha svg', 'viewBox')));
  overit('mapa zameru se nezvetsuje pres transform', true,
    !((await stranka.getAttribute('[data-mapa-vnitrek]', 'style')) ?? '').includes('scale'));

  // Odznaky lezi nad mapou jako HTML, takze se pri priblizeni musi presunout
  // samy — jinak by ukazovaly na uplne jine misto, nez ke kteremu patri.
  const odznakPred = await stranka.getAttribute('.mapa-bod[data-bod="1"]', 'style');
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(400);
  overit('odznaky se pri priblizeni presunou', true,
    odznakPred !== (await stranka.getAttribute('.mapa-bod[data-bod="1"]', 'style')));

  // Vybrany bod musi zustat zvyrazneny i po odjeti mysi. Klik do mapy
  // odroluje na polozku v seznamu, mapa se pohne pod kurzorem a `mouseleave`
  // drive zvyrazneni hned zhaslo — clovek pak nevedel, co si vybral.
  // Predchozi test nechal zapnuty filtr, ktery bod 1 skryva a odebira mu
  // `pointer-events` — bez zruseni filtru by klik propadl do mapy pod nim.
  await stranka.click('.mapa-filtry .filtr[data-tema=""]');
  await stranka.waitForTimeout(300);
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(300);
  await stranka.click('.mapa-bod[data-bod="1"]');
  await stranka.waitForTimeout(600);
  await stranka.mouse.move(5, 5);
  await stranka.waitForTimeout(400);
  overit('vybrany bod zustane zvyrazneny i po odjeti mysi', 1,
    await stranka.locator('.mapa-bod.je-zvyrazneny').count());

  // Stipnuti dvema prsty musi priblizit mapu, ne celou stranku. Rozhoduje
  // o tom `touch-action`: bez `pan-y` si gesto vezme prohlizec sam.
  const dotyk = (sel) => stranka.$eval(sel, (e) => getComputedStyle(e).touchAction);
  const oddalMapu = async () => {
    const t = stranka.locator('[data-zoom="reset"]');
    if (await t.isEnabled()) {
      await t.click();
      await stranka.waitForTimeout(300);
    }
  };

  await oddalMapu();
  overit('oddalena mapa zameru pusti stipnuti do skriptu', 'pan-y',
    await dotyk('.mapa-plocha'));
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(300);
  overit('priblizena mapa zameru posouva mapu, ne stranku', 'none',
    await dotyk('.mapa-plocha'));
  overit('ostatni body pri vyberu ustoupi', true,
    (await stranka.getAttribute('.mapa-plocha', 'data-zvyraznuji')) !== null);

  // --- Kde volit -----------------------------------------------------------
  // Vyhledavac rika lidem, kam maji jit volit. Kdyby ukazoval spatne, poslali
  // bychom je do nespravne mistnosti — proto se kontroluje proti udajum
  // z uredni vyhlasky mesta.
  await stranka.goto(`${ADRESA}kde-volit/`, { waitUntil: 'networkidle' });
  await stranka.waitForTimeout(500);

  // Plochy se sluci podle budovy, ne podle okrsku: nekolik okrsku voli
  // na stejnem miste a pro volice je to jedna oblast.
  overit('mapa ma plochy budov', 15, await stranka.locator('.budova-plocha').count());

  const najdiAdresu = async (text) => {
    await stranka.fill('[data-vstup]', '');
    await stranka.fill('[data-vstup]', text);
    await stranka.waitForTimeout(800);
    if (!(await stranka.locator('.navrhy li').count())) return null;
    await stranka.locator('.navrhy li').first().click();
    await stranka.waitForTimeout(600);
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
    await stranka.locator('.budova-plocha[data-vybrany]').count());
  overit('nalezena adresa se ukaze na mape', true, await stranka.locator('.moje-adresa').isVisible());
  overit('do mapy se vypise cil', true, await stranka.locator('[data-popis-cile]').isVisible());
  overit('do mapy se vypise adresa', true, await stranka.locator('[data-popis-adresy]').isVisible());
  overit('vede se spojnice', true,
    ((await stranka.getAttribute('.spojnice path', 'd')) ?? '').length > 5);

  // Klik do mapy je druha cesta ke stejne odpovedi.
  // Predchozi hledani adresy mapu priblizilo ke Lhote, takze se nejdriv vrati
  // pohled na celou obec — jinak by hledana oblast lezela mimo ram.
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(400);
  await stranka.locator('.mapa-plocha').scrollIntoViewIfNeeded();
  await stranka.waitForTimeout(200);

  // Stred obalky nepravidelneho tvaru casto lezi mimo nej, takze se bod
  // uvnitr najde pres isPointInFill a klika se na skutecne souradnice.
  // Musi lezet i uvnitr ramu mapy: `isPointInFill` o orezani nevi a vratil by
  // i bod, ktery je odrolovany nebo schovany za okrajem.
  const bodUvnitr = await stranka.evaluate(() => {
    const path = document.querySelector('.budova-plocha[data-okrsky~="20"] path');
    if (!path) return null;
    const ram = document.querySelector('.mapa-plocha').getBoundingClientRect();
    const b = path.getBBox();
    const ctm = path.getScreenCTM();
    for (let i = 1; i < 40; i++) {
      for (let j = 1; j < 40; j++) {
        const x = b.x + (b.width * i) / 40;
        const y = b.y + (b.height * j) / 40;
        if (!path.isPointInFill(new DOMPoint(x, y))) continue;
        const p = new DOMPoint(x, y).matrixTransform(ctm);
        const uvnitrRamu =
          p.x > ram.left + 4 && p.x < ram.right - 4 && p.y > ram.top + 4 && p.y < ram.bottom - 4;
        if (uvnitrRamu) return { x: p.x, y: p.y };
      }
    }
    return null;
  });
  overit('nasel jsem bod uvnitr oblasti', true, !!bodUvnitr);
  if (bodUvnitr) {
    await stranka.mouse.click(bodUvnitr.x, bodUvnitr.y);
    await stranka.waitForTimeout(600);
    overit('klik do mapy vybere oblast', true,
      (await stranka.textContent('.karta-misto')).includes('Morávkova'));
  }

  // Mapa musi jit zvetsit a viewBox se pri tom musi zmenit — kdyby se
  // zvetsovalo pres transform, SVG by se rozpixelovalo.
  const pred = await stranka.getAttribute('.mapa-plocha svg', 'viewBox');
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(400);
  const po = await stranka.getAttribute('.mapa-plocha svg', 'viewBox');
  overit('priblizeni meni viewBox', true, pred !== po);
  overit('mapa se nezvetsuje pres transform', '',
    (await stranka.getAttribute('.mapa-plocha svg', 'style')) ?? '');

  // Totez u mapy volebnich mistnosti.
  await oddalMapu();
  overit('oddalena mapa kde volit pusti stipnuti do skriptu', 'pan-y',
    await stranka.$eval('.mapa-plocha', (e) => getComputedStyle(e).touchAction));
  await stranka.click('[data-zoom="dovnitr"]');
  await stranka.waitForTimeout(300);
  overit('priblizena mapa kde volit posouva mapu, ne stranku', 'none',
    await stranka.$eval('.mapa-plocha', (e) => getComputedStyle(e).touchAction));

  // Nazvy mistnich casti se rozestupuji podle skutecneho prekryvu. Kdyby se
  // to rozbilo, mapa se necha prelepit nazvy pres sebe a stane se necitelnou.
  const popisky = async () =>
    await stranka.evaluate(() => {
      const ram = document.querySelector('.mapa-plocha').getBoundingClientRect();
      return [...document.querySelectorAll('.popisek-casti')]
        .filter((p) => !p.hidden)
        .map((p) => {
          const r = p.getBoundingClientRect();
          return {
            nazev: p.textContent,
            x1: r.left, y1: r.top, x2: r.right, y2: r.bottom,
            vRamu: r.left >= ram.left - 1 && r.right <= ram.right + 1 &&
                   r.top >= ram.top - 1 && r.bottom <= ram.bottom + 1,
          };
        });
    });

  const priblizene = await popisky();
  const kolize = priblizene.some((a, i) =>
    priblizene.some((b, j) => j > i && a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1));
  overit('nazvy casti se neprekryvaji', false, kolize);
  overit('nazvy casti nevycuhuji z mapy', true, priblizene.every((p) => p.vRamu));

  // Pri pohledu na celou obec se do stredu mesta vsechny nazvy nevejdou —
  // nektere se schovaji. To je zamer, ne chyba, takze se to hlida.
  //
  // Pocitat, kolik nazvu je videt po priblizeni, by nefungovalo: priblizeni
  // sice ve stredu udela misto, ale zaroven vytlaci okrajove casti z ramu,
  // takze jich celkem byva vic pri oddaleni. Hlida se proto konkretni nazev.
  await stranka.click('[data-zoom="reset"]');
  await stranka.waitForTimeout(400);
  const celkem = await stranka.locator('.popisek-casti').count();
  overit('na celou obec se nektere nazvy schovaji', true, (await popisky()).length < celkem);

  // Schovany nazev se ale musi dat odkryt, jinak by ta cast zustala bezejmenna.
  // Brnenska 5 lezi ve Vyskove-Meste, jehoz nazev je pri oddaleni prekryty.
  await najdiAdresu('Brněnská 5');
  overit('priblizeni odkryje schovany nazev', true,
    (await popisky()).some((p) => p.nazev === 'Vyškov-Město'));

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
