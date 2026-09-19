/**
 * Zmensi fotky kandidatu na rozumnou velikost pro web:  node nastroje/zmensit-fotky.mjs
 *
 * Puvodni fotky z fotoaparatu maji nekolik MB kazda a do gitu nepatri - viz
 * .gitignore. Zdroj je slozka `fotky-original/` (mimo verzovani), vysledek
 * jde do `src/assets/portrety/`, odkud uz fotky bere zbytek webu
 * (src/lib/portrety.ts). Nazev souboru se nemeni, jen pripona vzdy na .jpg.
 *
 * Pousti se SAM pred kazdym sestavenim i pred spustenim nahledu (viz
 * `package.json`). Staci tedy hodit fotku do `fotky-original/` a je hotovo -
 * driv se na rucni spusteni dalo snadno zapomenout a clovek pak marne hledal,
 * proc se na webu porad ukazuje silueta.
 *
 * Zmensuje jen to, co je potreba: kdyz uz hotova fotka existuje a je novejsi
 * nez original, preskoci se. Bez toho by kazde sestaveni znovu prepocitavalo
 * vsech sedmadvacet fotek.
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

let zmenseno = 0;
let preskoceno = 0;

for (const soubor of soubory) {
  const id = soubor.replace(/\.[^.]+$/, '');
  const vstup = path.join(ZDROJ, soubor);
  const vystup = path.join(CIL, `${id}.jpg`);

  const { size: velikostPred, mtimeMs: kdyOriginal } = fs.statSync(vstup);

  if (fs.existsSync(vystup) && fs.statSync(vystup).mtimeMs >= kdyOriginal) {
    preskoceno++;
    continue;
  }

  await sharp(vstup)
    .rotate() // otoci podle EXIF orientace, pak ji zahodi spolu se zbytkem metadat
    .resize({ width: NEJVETSI_ROZMER, height: NEJVETSI_ROZMER, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: KVALITA, mozjpeg: true })
    .toFile(vystup);

  const { size: velikostPo } = fs.statSync(vystup);
  const kB = (b) => Math.round(b / 1024);
  console.log(`   ${id}: ${kB(velikostPred)} kB -> ${kB(velikostPo)} kB`);
  zmenseno++;
}

// Kdyz nebylo co zmensovat, skript mlci. Pousti se pred kazdym sestavenim
// a hlaska "0 novych fotek" by jen zaplevelila vypis.
if (zmenseno) {
  console.log(`Zmenseno ${zmenseno} fotek do ${CIL}/.`);
}
