/**
 * Vyrobi nahledy pro sdileni:  node nastroje/nahledy-sdileni.mjs
 *
 * Kdyz nekdo hodi odkaz na web do Messengeru, na Facebook nebo na Instagram,
 * sit si stahne stranku a hleda v ni obrazek. Kdyz zadny nenajde, ukaze holy
 * odkaz - a ten na socialnich sitich nikdo neotevre. Tohle ty obrazky vyrabi.
 *
 * Kazda stranka ma svuj: mapa ukaze mapu, kandidati ukazi lidi, jak volit
 * ukaze volebni listek. Neni to ozdoba, je to obsah zmensený do jednoho
 * obrazku.
 *
 * Jak to funguje: skript slozi kartu jako obycejnou HTML stranku, otevre ji
 * v prohlizeci a vyfoti. Diky tomu ma kazda karta skutecne pismo webu
 * i skutecne barvy z tokenu - zadna druha sada hodnot, ktera by se casem
 * rozesla. Obrazky uvnitr karet se berou bud z pripravenych souboru
 * (nahledy map, portrety), nebo se vyfoti primo ze stranky.
 *
 * PRED SPUSTENIM musi bezet web:  npm run nahled
 * (nebo `npm run sestavit` a `npm run preview`)
 *
 * Vysledek se commituje. Pousti se, kdyz se stranka viditelne zmeni.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADRESA = process.env.ADRESA ?? 'http://localhost:4321/TV-web/';
const KAM = path.join(KOREN, 'public/nahledy');
const SEZNAM = path.join(KOREN, 'src/lib/nahledy-sdileni.json');

/**
 * Rozmer, ktery chteji socialni site.
 *
 * 1200 x 630 je pomer 1,91 : 1 - ten uvadi Facebook i Instagram a drzi se ho
 * i ostatni. Pri jinem pomeru si sit obrazek sama orizne, obvykle presne
 * pres nejdulezitejsi misto.
 */
const SIRKA = 1200;
const VYSKA = 630;

// --- Barvy a pismo z webu --------------------------------------------------

const tokeny = fs.readFileSync(path.join(KOREN, 'src/styles/tokeny.css'), 'utf8');

function token(nazev) {
  const shoda = tokeny.match(new RegExp('--' + nazev + ':\\s*([^;]+);'));
  if (!shoda) throw new Error('V tokeny.css chybi --' + nazev);
  return shoda[1].trim();
}

const BARVA = {
  noc: token('noc'),
  papir: token('papir'),
  inkoust: token('inkoust'),
  modra: token('modra'),
  zelena: token('zelena'),
  naNoci: token('na-noci'),
  naNociTlum: token('na-noci-tlum'),
  linkaNaNoci: token('linka-na-noci'),
};

/** Soubor jako `data:` adresa, aby karta nesahala nikam ven. */
function jakoData(soubor, typ) {
  return 'data:' + typ + ';base64,' + fs.readFileSync(soubor).toString('base64');
}

const PISMO = jakoData(path.join(KOREN, 'src/pisma/inter-latin-ext.woff2'), 'font/woff2');
const PISMO_ZAKLAD = jakoData(path.join(KOREN, 'src/pisma/inter-latin.woff2'), 'font/woff2');
const LOGO = fs.readFileSync(path.join(KOREN, 'public/logo.svg'), 'utf8');

// --- Co se na kterou kartu vykresli ---------------------------------------

/**
 * `obrazek` rika, odkud vzit vizual na pravou polovinu karty:
 *   soubor   - hotovy obrazek z repozitare
 *   ze stranky - vyfoti se prvek na zive strance
 *   portrety - slozi se z fotek kandidatu
 *   nic      - karta bude jen s textem pres celou sirku
 */
const KARTY = [
  {
    nazev: 'uvod',
    titulek: 'Jde to i jinak.',
    // Datum uz je v pate karty, dvakrat tam byt nemusi.
    popis: 'Sdružení nezávislých kandidátů pro Vyškov.',
    obrazek: null,
    velky: true,
  },
  {
    nazev: 'mapa',
    titulek: 'Program není seznam přání',
    popis: 'Jsou to místa, která denně míjíte. Ukazujeme na mapě, co a kde chceme udělat.',
    obrazek: { soubor: 'src/assets/nahled-mapa-zameru.png' },
  },
  {
    nazev: 'kde-volit',
    titulek: 'Nevíte, kam jít volit?',
    popis: 'Napište adresu a ukážeme vám na mapě, do které volební místnosti patříte.',
    obrazek: { soubor: 'src/assets/nahled-mapa-okrsku.png' },
  },
  {
    nazev: 'jak-volit',
    titulek: 'Do zastupitelstva máte 27 křížků',
    popis: 'Věděli jste to? Zkuste si volební lístek nanečisto a uvidíte, komu váš hlas připadne.',
    // Uzsi okno schvalne: listek je siroky tri sloupce a v plne sirce by
    // z nej na karte zbyl nectitelny vyrez.
    obrazek: { stranka: 'jak-volit/', prvek: '.listek', sirkaOkna: 760 },
  },
  {
    nazev: 'lide',
    titulek: 'Sedmadvacet Vyškováků',
    popis: 'Lidé, kteří chtějí radnici dělat jinak. Poznejte je jménem po jménu.',
    obrazek: { portrety: 3 },
  },
  {
    nazev: 'program',
    titulek: 'Náš program v osmi oblastech',
    popis: 'Hospodaření, bydlení, zeleň a voda, doprava, školství, kultura, podnikání, bezpečnost.',
    obrazek: { stranka: '', prvek: '.program-mrizka', sirkaOkna: 700 },
  },
  {
    nazev: 'kontakt',
    titulek: 'Ozvěte se nám',
    popis: 'Napište, co vás ve Vyškově trápí. Odpovídáme lidem, ne formulářům.',
    obrazek: null,
  },
  {
    nazev: 'vychozi',
    titulek: 'Transparentní Vyškov',
    popis: 'Sdružení nezávislých kandidátů pro komunální volby.',
    obrazek: null,
  },
];

// --- Slozeni karty ---------------------------------------------------------

function kresliKartu(karta, vizual) {
  const sirokyText = vizual ? '52%' : '100%';
  // `vizual` uz je hotovy kus HTML, ne adresa obrazku. Karta kandidatu ma
  // misto jednoho obrazku tri fotky vedle sebe, takze jedno `<img>` nestaci.
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
<style>
  @font-face {
    font-family: Inter;
    src: url('${PISMO_ZAKLAD}') format('woff2');
    unicode-range: U+0000-00FF;
    font-weight: 100 900;
  }
  @font-face {
    font-family: Inter;
    src: url('${PISMO}') format('woff2');
    unicode-range: U+0100-024F, U+1E00-1EFF, U+2C60-2C7F;
    font-weight: 100 900;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${SIRKA}px; height: ${VYSKA}px;
    display: flex; overflow: hidden;
    background: ${BARVA.noc};
    color: ${BARVA.naNoci};
    font-family: Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .text {
    width: ${sirokyText};
    padding: 56px 52px;
    display: flex; flex-direction: column; justify-content: space-between;
    ${vizual ? '' : 'align-items: center; text-align: center;'}
  }
  .logo { height: 58px; }
  .logo svg { height: 100%; width: auto; display: block; }
  h1 {
    font-size: ${karta.velky ? 78 : vizual ? 52 : 62}px;
    line-height: 1.04;
    letter-spacing: -0.03em;
    font-weight: 600;
    ${vizual ? '' : 'max-width: 18ch;'}
  }
  p {
    margin-top: 18px;
    font-size: ${vizual ? 23 : 27}px;
    line-height: 1.45;
    color: ${BARVA.naNociTlum};
    max-width: 34ch;
  }
  .pata {
    display: flex; gap: 18px; align-items: baseline;
    font-size: 21px; font-weight: 600;
  }
  .hashtag { color: ${BARVA.zelena}; }
  .datum { color: ${BARVA.naNociTlum}; font-weight: 400; }
  .vizual {
    width: 48%; position: relative;
    border-left: 1px solid ${BARVA.linkaNaNoci};
    background: ${BARVA.noc};
  }
  /* Vyrez se bere odshora. Zespodu by u listku i u dlazdic programu zbyl
     kus, ze ktereho nikdo nepozna, co to je. */
  .vizual img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  /* Přechod na levé hraně obrázku, aby z něj text nevypadal odstřižený. */
  .vizual::after {
    content: ''; position: absolute; inset: 0 auto 0 0; width: 90px;
    background: linear-gradient(to right, ${BARVA.noc}, transparent);
  }
</style></head>
<body>
  <div class="text">
    <div class="logo">${LOGO}</div>
    <div>
      <h1>${karta.titulek}</h1>
      <p>${karta.popis}</p>
    </div>
    <div class="pata">
      <span class="hashtag">#Jdetoijinak</span>
      <span class="datum">volby 9.–10. října 2026</span>
    </div>
  </div>
  ${vizual ? `<div class="vizual">${vizual}</div>` : ''}
</body></html>`;
}

/**
 * Fotky kandidatu vedle sebe, ne pod sebou.
 *
 * Portret je na vysku. Ve vodorovnem pruhu by z nej zbyl vyrez pres oci,
 * kdezto uzky sloupec sedi na tvar fotky a je v nem videt cely oblicej.
 */
function kresliPortrety(fotky) {
  return (
    `<div style="display:flex;height:100%">` +
    fotky
      .map(
        (f) =>
          `<img src="${f}" style="flex:1 1 0;min-width:0;height:100%;object-fit:cover;display:block">`,
      )
      .join('') +
    '</div>'
  );
}

// --- Beh -------------------------------------------------------------------

async function spustProhlizec() {
  for (const kanal of ['msedge', 'chrome', 'chromium']) {
    try {
      return await chromium.launch({ channel: kanal });
    } catch {
      // zkusime dalsi
    }
  }
  console.log('Nenasel jsem Edge ani Chrome. Nahledy nelze vyrobit.');
  process.exit(1);
}

const prohlizec = await spustProhlizec();

try {
  fs.mkdirSync(KAM, { recursive: true });

  for (const karta of KARTY) {
    let vizual = null;

    if (karta.obrazek?.soubor) {
      vizual = `<img src="${jakoData(path.join(KOREN, karta.obrazek.soubor), 'image/png')}">`;
    } else if (karta.obrazek?.stranka !== undefined) {
      // Vizual se vyfoti primo ze zive stranky, at se s ni nemuze rozejit.
      const s = await prohlizec.newPage({
        viewport: { width: karta.obrazek.sirkaOkna ?? 760, height: 900 },
      });
      await s.goto(ADRESA + karta.obrazek.stranka, { waitUntil: 'networkidle' });
      // Lepive prvky se po odrolovani k prvku polozi pres nej: navigace webu
      // shora, u volebniho listku jeho vlastni pruh s poctem krizku pres prvni
      // radek. Na snimku to vypada jako chyba vykresleni, takze se na chvili
      // usadi natvrdo.
      await s.evaluate(() => {
        for (const prvek of document.querySelectorAll('.pruh-draft')) {
          prvek.style.display = 'none';
        }
        for (const prvek of document.querySelectorAll('*')) {
          if (getComputedStyle(prvek).position === 'sticky') prvek.style.position = 'static';
        }
      });
      await s.waitForTimeout(800);
      const prvek = s.locator(karta.obrazek.prvek).first();
      await prvek.scrollIntoViewIfNeeded();
      await s.waitForTimeout(400);
      const snimek = await prvek.screenshot();
      await s.close();
      vizual = `<img src="data:image/png;base64,${snimek.toString('base64')}">`;
    } else if (karta.obrazek?.portrety) {
      const soubory = fs
        .readdirSync(path.join(KOREN, 'src/assets/portrety'))
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort()
        .slice(0, karta.obrazek.portrety);
      if (!soubory.length) throw new Error('Ve slozce portretu nic neni.');
      vizual = kresliPortrety(
        soubory.map((f) => jakoData(path.join(KOREN, 'src/assets/portrety', f), 'image/jpeg')),
      );
    }

    const html = kresliKartu(karta, vizual);

    const s = await prohlizec.newPage({ viewport: { width: SIRKA, height: VYSKA } });
    await s.setContent(html, { waitUntil: 'networkidle' });
    await s.evaluate(() => document.fonts.ready);
    await s.waitForTimeout(300);
    const kam = path.join(KAM, karta.nazev + '.png');
    await s.screenshot({ path: kam });
    await s.close();

    console.log('   ' + (karta.nazev + '.png').padEnd(18) + Math.round(fs.statSync(kam).size / 1024) + ' kB');
  }

  // Seznam pro web: rozvrzeni podle nej pozna, jestli pro stranku karta je.
  fs.writeFileSync(SEZNAM, JSON.stringify(KARTY.map((k) => k.nazev), null, 2) + '\n');
  console.log('   ' + path.relative(KOREN, SEZNAM));
} finally {
  await prohlizec.close();
}

console.log('\nHotovo. Nezapomente vysledek commitnout.');
