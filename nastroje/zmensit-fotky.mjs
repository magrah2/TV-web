/**
 * Zmensi fotky kandidatu na rozumnou velikost pro web:  node nastroje/zmensit-fotky.mjs
 *
 * Puvodni fotky z fotoaparatu maji nekolik MB kazda a do gitu nepatri - viz
 * .gitignore. Zdroj je slozka `fotky-original/` (mimo verzovani), vysledek
 * jde do `src/assets/portrety/`, odkud uz fotky bere zbytek webu
 * (src/lib/portrety.ts). Nazev souboru se nemeni, jen pripona vzdy na .jpg.
 *
 * Bezpecne se da spoustet opakovane - kazde spusteni prepise vsechno znovu.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ZDROJ = 'fotky-original';
const CIL = 'src/assets/portrety';

// Vetsi nez nejvetsi velikost, ve ktere web fotku skutecne pouzije
// (detail medailonku chce nejvys 1080 px sirky) - rezerva pro ostre displeje.
const NEJVETSI_ROZMER = 1600;
const KVALITA = 82;

if (!fs.existsSync(ZDROJ)) {
  console.log(`Slozka ${ZDROJ}/ neexistuje - neni co zmensovat.`);
  process.exit(0);
}

const soubory = fs.readdirSync(ZDROJ).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

if (soubory.length === 0) {
  console.log(`Ve slozce ${ZDROJ}/ nejsou zadne fotky.`);
  process.exit(0);
}

fs.mkdirSync(CIL, { recursive: true });

for (const soubor of soubory) {
  const id = soubor.replace(/\.[^.]+$/, '');
  const vstup = path.join(ZDROJ, soubor);
  const vystup = path.join(CIL, `${id}.jpg`);

  const { size: velikostPred } = fs.statSync(vstup);

  await sharp(vstup)
    .rotate() // otoci podle EXIF orientace, pak ji zahodi spolu se zbytkem metadat
    .resize({ width: NEJVETSI_ROZMER, height: NEJVETSI_ROZMER, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: KVALITA, mozjpeg: true })
    .toFile(vystup);

  const { size: velikostPo } = fs.statSync(vystup);
  const kB = (b) => Math.round(b / 1024);
  console.log(`${id}: ${kB(velikostPred)} kB -> ${kB(velikostPo)} kB`);
}

console.log(`\nHotovo - ${soubory.length} fotek v ${CIL}/.`);
