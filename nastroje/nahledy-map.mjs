/**
 * Vyrobi nahledy map na uvodni stranku:  node nastroje/nahledy-map.mjs
 *
 * Na uvodni strance vedou dva prokliky na mapy - na mapu zameru a na hledani
 * volebni mistnosti - a u obou je videt, jak ta mapa zhruba vypada. Nahled se
 * bere z tehoz podkladu, ktery je na cilove strance, takze se s ni nemuze
 * rozejit.
 *
 * Proc obrazek a ne SVG primo ve strance: podklady maji 322 kB a 207 kB,
 * protoze je v nich pres dva tisice ulic a pesin. I kdyz se z nich vezme jen
 * silueta zastavby a reky, zbyde 61 kB a 25 kB - to je na dve miniatury moc.
 * Obrazek vazi zlomek a Astro si z nej udela webp a avif samo.
 *
 * Barvy se ctou z `tokeny.css`, aby nebyly zapsane na dvou mistech. V SVG
 * musi byt primo u tvaru: rasterizace nevi nic o CSS webu.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIRKA = 1000;

// --- Barvy z tokenu --------------------------------------------------------

const tokeny = fs.readFileSync(path.join(KOREN, 'src/styles/tokeny.css'), 'utf8');

function token(nazev) {
  const shoda = tokeny.match(new RegExp('--' + nazev + ':\\s*([^;]+);'));
  if (!shoda) throw new Error('V tokeny.css chybi --' + nazev);
  return shoda[1].trim();
}

const BARVY = {
  pozadi: token('noc'),
  'mapa-zastavba': token('mapa-zastavba'),
  'mapa-prumysl': token('mapa-prumysl'),
  'mapa-zelen': token('mapa-zelen'),
  'mapa-vodni-plocha': token('mapa-voda'),
  'mapa-reka': token('zelena'),
};

// --- Vytazeni siluety ------------------------------------------------------

/**
 * Vrati jednu skupinu z podkladu.
 *
 * Hleda se pres `indexOf`, ne regularnim vyrazem: skupiny jsou prosté
 * `<g class="…">…</g>` a nevnoruji se, takze na to staci najit zacatek
 * a nejblizsi konec.
 */
function skupina(svg, trida) {
  const zacatek = svg.indexOf(`<g class="${trida}">`);
  if (zacatek < 0) return '';
  const konec = svg.indexOf('</g>', zacatek);
  return svg.slice(zacatek, konec + 4);
}

const PLOCHY = ['mapa-zastavba', 'mapa-prumysl', 'mapa-zelen', 'mapa-vodni-plocha'];

/**
 * Barvy volebnich oblasti se ctou z KdeVolit.astro, aby nebyly opsane na dvou
 * mistech - nahled ma ukazovat totez, co je na te strance.
 */
function barvyOblasti() {
  const zdroj = fs.readFileSync(path.join(KOREN, 'src/components/KdeVolit.astro'), 'utf8');
  const ven = [];
  for (let i = 0; ; i++) {
    const klic = `data-barva='${i}'] path) { fill: `;
    const zacatek = zdroj.indexOf(klic);
    if (zacatek < 0) break;
    const od = zacatek + klic.length;
    ven.push(zdroj.slice(od, zdroj.indexOf(';', od)).trim());
  }
  if (!ven.length) throw new Error('V KdeVolit.astro se nenasly barvy oblasti');
  return ven;
}

/**
 * Plochy volebnich oblasti z `mapa-okrsky.svg`. Maji tentyz viewBox jako
 * podklad obce, takze se daji polozit primo pres nej.
 *
 * Kreslí se pruhledne a s bilym obrysem, stejne jako na strance: pod barvou
 * musi zustat videt zastavba, jinak je z mapy barevna deka.
 */
function oblasti(svg, barvy) {
  const ZNACKA = '<g class="budova-plocha"';
  const ven = [];
  let od = 0;
  for (;;) {
    const zacatek = svg.indexOf(ZNACKA, od);
    if (zacatek < 0) break;
    const konecZnacky = svg.indexOf('>', zacatek);
    const konec = svg.indexOf('</g>', konecZnacky) + 4;
    const hlavicka = svg.slice(zacatek, konecZnacky + 1);

    const klic = 'data-barva="';
    const kde = hlavicka.indexOf(klic) + klic.length;
    const cislo = Number(hlavicka.slice(kde, hlavicka.indexOf('"', kde)));

    ven.push(
      `<g fill="${barvy[cislo % barvy.length]}" fill-opacity="0.32" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.6" stroke-linejoin="round">` +
        svg.slice(konecZnacky + 1, konec),
    );
    od = konec;
  }
  return ven.join('');
}

function silueta(svg, vyska, body, plochyOblasti) {
  const hlavicka = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIRKA} ${vyska}" width="${SIRKA}" height="${vyska}">`;
  const podklad = `<rect width="${SIRKA}" height="${vyska}" fill="${BARVY.pozadi}"/>`;

  const plochy = PLOCHY.map((trida) =>
    skupina(svg, trida).replace(
      `<g class="${trida}">`,
      `<g fill="${BARVY[trida]}">`,
    ),
  ).join('');

  const reka = skupina(svg, 'mapa-reka').replace(
    '<g class="mapa-reka">',
    `<g fill="none" stroke="${BARVY['mapa-reka']}" stroke-width="3" opacity="0.75">`,
  );

  const znacky = body
    .map((b) => `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="9" fill="${b.barva}" stroke="#fff" stroke-width="2.5"/>`)
    .join('');

  return hlavicka + podklad + plochy + reka + plochyOblasti + znacky + '</svg>';
}

// --- Body zameru -----------------------------------------------------------

/**
 * Body se kresli tam, kde jsou na mape zameru. Bez nich by nahled ukazoval
 * jen obrys mesta a nebylo by z nej poznat, o jakou mapu jde.
 */
const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

function bodyZameru(vyrez) {
  const slozka = path.join(KOREN, 'src/content/zamery');
  const meritko = vyrez.sirka / (vyrez.vychod - vyrez.zapad);
  const yJih = merkator(vyrez.jih);

  const barvyTemat = fs.readFileSync(path.join(KOREN, 'src/lib/temata.ts'), 'utf8');

  return fs
    .readdirSync(slozka)
    .filter((jmeno) => jmeno.endsWith('.md') && !jmeno.startsWith('_'))
    .map((jmeno) => {
      const text = fs.readFileSync(path.join(slozka, jmeno), 'utf8');
      const cislo = (klic) => Number((text.match(new RegExp('^' + klic + ':\\s*(.+)$', 'm')) ?? [])[1]);
      const tema = (text.match(/^tema:\s*(.+)$/m) ?? [])[1]?.trim();
      const barva = (barvyTemat.match(new RegExp("'" + tema + "':\\s*'([^']+)'")) ?? [])[1] ?? '#5bae39';
      const lat = cislo('lat');
      const lon = cislo('lon');
      return {
        x: (lon - vyrez.zapad) * meritko,
        y: vyrez.vyska - (merkator(lat) - yJih) * (180 / Math.PI) * meritko,
        barva,
      };
    });
}

// --- Vyroba ----------------------------------------------------------------

const MAPY = [
  {
    nazev: 'nahled-mapa-zameru',
    podklad: 'public/mapa-vyskov.svg',
    vyrez: 'src/lib/mapa-vyrez.json',
    sBody: true,
  },
  {
    nazev: 'nahled-mapa-okrsku',
    podklad: 'public/mapa-obec.svg',
    vyrez: 'src/lib/mapa-vyrez-obec.json',
    sBody: false,
    sOblastmi: 'public/mapa-okrsky.svg',
  },
];

for (const mapa of MAPY) {
  const svg = fs.readFileSync(path.join(KOREN, mapa.podklad), 'utf8');
  const vyrez = JSON.parse(fs.readFileSync(path.join(KOREN, mapa.vyrez), 'utf8'));
  const body = mapa.sBody ? bodyZameru(vyrez) : [];

  const plochyOblasti = mapa.sOblastmi
    ? oblasti(fs.readFileSync(path.join(KOREN, mapa.sOblastmi), 'utf8'), barvyOblasti())
    : '';

  const kresba = silueta(svg, vyrez.vyska, body, plochyOblasti);
  const kam = path.join(KOREN, 'src/assets', mapa.nazev + '.png');
  await sharp(Buffer.from(kresba)).png({ compressionLevel: 9 }).toFile(kam);

  const velikost = Math.round(fs.statSync(kam).size / 1024);
  console.log('  %s  %s x %s  %s kB%s',
    (mapa.nazev + '.png').padEnd(28), SIRKA, vyrez.vyska, String(velikost).padStart(4),
    body.length ? '  (' + body.length + ' bodu)' : (plochyOblasti ? '  (s oblastmi)' : ''));
}

console.log('');
console.log('Hotovo. Obrazky lezi v src/assets a Astro si z nich udela webp samo.');
