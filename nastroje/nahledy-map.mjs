/**
 * Vyrobi nahledy map:  node nastroje/nahledy-map.mjs
 *
 * Obrazky slouzi dvema vecem najednou:
 *
 *   1. Na uvodni strance vedou dva prokliky na mapy - na mapu zameru a na
 *      hledani volebni mistnosti - a u obou je videt, jak ta mapa vypada.
 *   2. Bez JavaScriptu se mapa nevykresli vubec (je vektorova, sklada ji
 *      knihovna v prohlizeci). Misto prazdneho ramu se pak ukaze prave
 *      tenhle obrazek.
 *
 * Driv se nahledy kreslily zvlast - z tehoz podkladu, ale vlastnim kodem.
 * To uz nejde a je to tak lepsi: mapa se ted sklada z vektorovych dlazdic
 * a napodobit ji druhym kodem by znamenalo psat cely vykreslovac znovu.
 * Skript proto otevre skutecnou stranku v prohlizeci a mapu vyfoti. Nahled
 * a mapa se tim nemuzou rozejit ani o pixel.
 *
 * PRED SPUSTENIM musi bezet web:  npm run nahled
 * (nebo `npm run sestavit` a `npm run preview`)
 *
 * Vysledek se commituje. Pousti se jen tehdy, kdyz se mapa viditelne zmeni.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADRESA = process.env.ADRESA ?? 'http://localhost:4321/TV-web/';

/**
 * Rozmer snimku.
 *
 * Nahled na uvodni strance je siroky nejvyse 560 bodu, takze dvojnasobek
 * staci i na displeje s vysokym rozlisenim. Zaroven je to rozmer, ve kterem
 * mapa vypada jako mapa - pri mensim by z popisku byla kase.
 *
 * Obe mapy maji ROVNAT rozmer, i kdyz na svych strankach vypadaji jinak.
 * Mapa zameru stoji v uzsim sloupci vedle seznamu, takze bez tohohle by
 * z ni byl nahled na vysku a vedle druheho by vypadal jako omyl.
 */
const SIRKA = 1120;
const VYSKA = 800;

const MAPY = [
  {
    nazev: 'nahled-mapa-zameru',
    adresa: 'mapa/',
    popis: 'mapa zameru',
  },
  {
    nazev: 'nahled-mapa-okrsku',
    adresa: 'kde-volit/',
    popis: 'mapa volebnich okrsku',
  },
];

/** Spusti prvni prohlizec, ktery je na pocitaci k dispozici. */
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
  for (const mapa of MAPY) {
    const stranka = await prohlizec.newPage({
      // Okno je sirsi nez snimek, aby se ram mapy mel kam roztahnout.
      viewport: { width: SIRKA + 320, height: VYSKA + 400 },
      // Bez toho by snimek mel rozliseni okna a popisky by byly rozmazane.
      deviceScaleFactor: 1,
    });

    await stranka.goto(ADRESA + mapa.adresa, { waitUntil: 'networkidle' });

    // Ram mapy se roztahne na plnou vysku snimku. Nahled ma ukazat mapu,
    // ne kus stranky kolem ni.
    await stranka.evaluate(
      ({ sirka, vyska }) => {
        const ram = document.querySelector('.mapa-plocha');

        // Mapa zameru stoji v mrizce vedle seznamu zameru. Bez tohohle by
        // nahled dostal sirku toho sloupce, tedy jinou nez druha mapa.
        const rozvrzeni = ram.closest('.mapa-rozvrzeni');
        if (rozvrzeni) rozvrzeni.style.gridTemplateColumns = '1fr';
        for (const seznam of document.querySelectorAll('.mapa-seznam')) {
          seznam.style.display = 'none';
        }
        const obal = ram.parentElement;
        obal.style.position = 'static';
        obal.style.width = sirka + 'px';

        ram.style.width = sirka + 'px';
        ram.style.maxWidth = 'none';
        ram.style.height = vyska + 'px';
        ram.style.aspectRatio = 'auto';
        ram.style.borderRadius = '0';
        ram.style.border = 'none';
        // Ovladaci prvky do nahledu nepatri - je to obrazek, ne mapa.
        // Napoveda "posunete dvema prsty" se navic mihne pokazde, kdyz se
        // strankou hne, takze by ji snimek chytil taky.
        for (const co of [
          '.mapa-ovladani',
          '.maplibregl-ctrl-bottom-left',
          '.maplibregl-cooperative-gesture-screen',
        ]) {
          for (const prvek of document.querySelectorAll(co)) prvek.style.display = 'none';
        }
        window.dispatchEvent(new Event('resize'));
      },
      { sirka: SIRKA, vyska: VYSKA },
    );

    // Mapa se po zmene rozmeru musi znovu usadit a dokreslit dlazdice.
    await stranka.waitForTimeout(4000);

    const kam = path.join(KOREN, 'src/assets', mapa.nazev + '.png');
    await stranka.locator('.mapa-plocha').screenshot({ path: kam });
    await stranka.close();

    // Rozmery se ctou ze samotneho souboru, ne z konstant. Kdyby se ram
    // nepodarilo roztahnout, cisla by to prozradila.
    const soubor = fs.readFileSync(kam);
    const rozmer = soubor.readUInt32BE(16) + ' x ' + soubor.readUInt32BE(20);
    const velikost = Math.round(soubor.length / 1024);
    console.log('   ' + (mapa.nazev + '.png').padEnd(26) + rozmer.padEnd(12) + velikost + ' kB   (' + mapa.popis + ')');
  }
} finally {
  await prohlizec.close();
}

console.log('\nHotovo. Nezapomente vysledek commitnout.');
