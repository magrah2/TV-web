/**
 * Vyrobi data pro vyhledavac volebni mistnosti:  node nastroje/okrsky.mjs
 *
 * Zdroj je CUZK (RUIAN), kde je ke kazde adrese v obci uvedene cislo volebniho
 * okrsku. Vymezeni okrsku tam zapisuje starosta, takze je to primo ten uredni
 * udaj — neopisujeme ho rucne z vyhlasky a nemuzeme se v nem uklepnout.
 *
 *   https://services.cuzk.gov.cz/sestavy/VO/592889.zip   (592889 = Vyskov)
 *   Otevrena data, licence CC-BY 4.0.
 *
 * Souradnice jsou v CSV v S-JTSK. Prevod na zemepisne stupne se NEPOCITA
 * z Krovakovych konstant, ale napasuje se na skutecne adresni body
 * z OpenStreetMap: Krovak je konformni, takze na uzemi jednoho mesta je vztah
 * prakticky afinni. Skript si presnost sam zmeri a kdyz nesedi, skonci chybou.
 *
 * Vysledek: src/lib/okrsky.json  (commituje se, web uz nikam nesaha)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const KOD_OBCE = '592889'; // Vyskov
const ZDROJ = `https://services.cuzk.gov.cz/sestavy/VO/${KOD_OBCE}.zip`;
const DOCASNE = 'nastroje/.okrsky';
// Data lezi v public/, ne v src/: maji skoro 200 kB a nacita je jen jedna
// stranka. Vlozena do HTML by zbytecne zvetsila kazdou jinou.
const CIL = 'public/data/okrsky.json';
const CIL_PLOCHY = 'public/mapa-okrsky.svg';
// Sirsi mapa cele obce — okrsky 24 a 25 (Rychtarov, Lhota) lezi mimo
// tesny vyrez mesta a na te uzsi mape by je nikdo nenasel.
const VYREZ_JSON = 'src/lib/mapa-vyrez-obec.json';
const NEJVETSI_ODCHYLKA = 5; // metru; nad tim prevod povazujeme za chybny

const krok = (t) => console.log('\n>> ' + t);
const info = (t) => console.log('   ' + t);

function skonci(duvod) {
  console.log('\n!! ' + duvod);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Stazeni a rozbaleni dat CUZK
// ---------------------------------------------------------------------------

fs.mkdirSync(DOCASNE, { recursive: true });
const zipCesta = path.join(DOCASNE, `${KOD_OBCE}.zip`);

if (!fs.existsSync(zipCesta)) {
  krok('Stahuji adresy s cisly okrsku z CUZK.');
  const odpoved = await fetch(ZDROJ, { headers: { 'User-Agent': 'transparentnivyskov.cz' } });
  if (!odpoved.ok) skonci(`CUZK odpovedel ${odpoved.status}. Zkontrolujte ${ZDROJ}`);
  fs.writeFileSync(zipCesta, Buffer.from(await odpoved.arrayBuffer()));
  info('ulozeno do ' + zipCesta);
} else {
  krok('Pouzivam drive stazena data z ' + zipCesta);
}

const rozbaleno = path.join(DOCASNE, 'rozbaleno');
fs.rmSync(rozbaleno, { recursive: true, force: true });
execFileSync('powershell', [
  '-NoProfile', '-Command',
  `Expand-Archive -Path '${zipCesta}' -DestinationPath '${rozbaleno}' -Force`,
]);

const csvCesta = (function najdi(adresar) {
  for (const polozka of fs.readdirSync(adresar, { withFileTypes: true })) {
    const cela = path.join(adresar, polozka.name);
    if (polozka.isDirectory()) {
      const nalez = najdi(cela);
      if (nalez) return nalez;
    } else if (polozka.name.toLowerCase().endsWith('.csv')) return cela;
  }
  return null;
})(rozbaleno);

if (!csvCesta) skonci('V archivu z CUZK nebyl zadny soubor CSV.');

// CSV z CUZK je ve windows-1250, ne v UTF-8. Kdyz se to splete, rozsypou se
// nazvy sloupcu a skript pak nenajde ani jednu adresu.
const text = new TextDecoder('windows-1250').decode(fs.readFileSync(csvCesta));
const radky = text.split(/\r?\n/).filter(Boolean);
const hlavicka = radky[0].split(';');

const sloupec = (nazev) => {
  const i = hlavicka.indexOf(nazev);
  if (i < 0) skonci(`V datech CUZK chybi sloupec "${nazev}". Zmenil se format?`);
  return i;
};

const S = {
  cast: sloupec('Název části obce'),
  ulice: sloupec('Název ulice'),
  cp: sloupec('Číslo domovní'),
  co: sloupec('Číslo orientační'),
  znak: sloupec('Znak čísla orientačního'),
  x: sloupec('Souřadnice X'),
  y: sloupec('Souřadnice Y'),
  okrsek: sloupec('Číslo volebního okrsku'),
};

const cislo = (h) => (h && h.trim() ? Math.round(parseFloat(h)) : null);

const adresy = radky
  .slice(1)
  .map((r) => {
    const s = r.split(';');
    return {
      cast: (s[S.cast] || '').trim(),
      ulice: (s[S.ulice] || '').trim(),
      cp: (s[S.cp] || '').trim(),
      co: cislo(s[S.co]),
      znak: (s[S.znak] || '').trim(),
      x: parseFloat(s[S.x]),
      y: parseFloat(s[S.y]),
      okrsek: cislo(s[S.okrsek]),
    };
  })
  .filter((a) => a.okrsek && isFinite(a.x) && isFinite(a.y));

krok(`Nacteno ${adresy.length} adres, ${new Set(adresy.map((a) => a.okrsek)).size} okrsku.`);

// ---------------------------------------------------------------------------
// 2. Prevod souradnic, napasovany na adresni body z OSM
// ---------------------------------------------------------------------------

const OSM_CACHE = path.join(DOCASNE, 'osm-adresy.json');
let osm;
if (fs.existsSync(OSM_CACHE)) {
  osm = JSON.parse(fs.readFileSync(OSM_CACHE, 'utf8'));
} else {
  krok('Stahuji kontrolni adresni body z OpenStreetMap.');
  const dotaz = `[out:json][timeout:180];
    node["addr:street"]["addr:conscriptionnumber"](49.24,16.92,49.33,17.07);
    out body;`;
  const odpoved = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'transparentnivyskov.cz',
    },
    body: new URLSearchParams({ data: dotaz }),
  });
  if (!odpoved.ok) skonci(`Overpass odpovedel ${odpoved.status}.`);
  osm = await odpoved.json();
  fs.writeFileSync(OSM_CACHE, JSON.stringify(osm));
}

const podleUliceCp = new Map();
for (const a of adresy) {
  if (a.ulice && a.cp) podleUliceCp.set(a.ulice.toLowerCase() + '|' + a.cp, a);
}

let kontrolni = [];
for (const e of osm.elements ?? []) {
  const ulice = (e.tags?.['addr:street'] || '').trim().toLowerCase();
  const cp = (e.tags?.['addr:conscriptionnumber'] || '').trim();
  const shoda = podleUliceCp.get(ulice + '|' + cp);
  if (shoda) kontrolni.push({ x: shoda.x, y: shoda.y, lat: e.lat, lon: e.lon });
}
if (kontrolni.length < 50) skonci(`Nasel jsem jen ${kontrolni.length} kontrolnich bodu, to je malo.`);

/** Nejmensi ctverce pro lat = a*x + b*y + c. */
function napasuj(body, hodnota) {
  let Sxx = 0, Sxy = 0, Sx1 = 0, Syy = 0, Sy1 = 0, S11 = 0, Sxc = 0, Syc = 0, S1c = 0;
  for (const b of body) {
    const c = hodnota(b);
    Sxx += b.x * b.x; Sxy += b.x * b.y; Sx1 += b.x;
    Syy += b.y * b.y; Sy1 += b.y; S11 += 1;
    Sxc += b.x * c; Syc += b.y * c; S1c += c;
  }
  const M = [[Sxx, Sxy, Sx1], [Sxy, Syy, Sy1], [Sx1, Sy1, S11]];
  const v = [Sxc, Syc, S1c];
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    [M[i], M[p]] = [M[p], M[i]];
    [v[i], v[p]] = [v[p], v[i]];
    for (let j = i + 1; j < 3; j++) {
      const f = M[j][i] / M[i][i];
      for (let k = i; k < 3; k++) M[j][k] -= f * M[i][k];
      v[j] -= f * v[i];
    }
  }
  const r = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = v[i];
    for (let k = i + 1; k < 3; k++) s -= M[i][k] * r[k];
    r[i] = s / M[i][i];
  }
  return r;
}

let A = napasuj(kontrolni, (b) => b.lat);
let B = napasuj(kontrolni, (b) => b.lon);
const naStupne = (x, y) => ({ lat: A[0] * x + A[1] * y + A[2], lon: B[0] * x + B[1] * y + B[2] });
const odchylkaM = (b) => {
  const { lat, lon } = naStupne(b.x, b.y);
  return Math.hypot((lat - b.lat) * 111320, (lon - b.lon) * 111320 * Math.cos((lat * Math.PI) / 180));
};

// Stejny nazev ulice a cislo popisne se ve meste opakuje ve vice castech,
// takze cast parovani je chybna. Odlehle body opakovane vyhazujeme.
krok('Napasovavam prevod souradnic.');
for (let kolo = 0; kolo < 8; kolo++) {
  const d = kontrolni.map(odchylkaM).sort((a, b) => a - b);
  const median = d[Math.floor(d.length / 2)];
  const mez = Math.max(3, median * 6);
  const ponechat = kontrolni.filter((b) => odchylkaM(b) <= mez);
  if (ponechat.length === kontrolni.length) break;
  kontrolni = ponechat;
  A = napasuj(kontrolni, (b) => b.lat);
  B = napasuj(kontrolni, (b) => b.lon);
}

const odchylky = kontrolni.map(odchylkaM);
const nejvetsi = Math.max(...odchylky);
const prumer = odchylky.reduce((s, d) => s + d, 0) / odchylky.length;
info(`kontrolnich bodu: ${kontrolni.length}`);
info(`prumerna odchylka: ${prumer.toFixed(2)} m, nejvetsi: ${nejvetsi.toFixed(2)} m`);
if (nejvetsi > NEJVETSI_ODCHYLKA) {
  skonci(`Prevod souradnic je nepresny (${nejvetsi.toFixed(1)} m). Data se nezapsala.`);
}

// ---------------------------------------------------------------------------
// 3. Sestaveni vysledku
// ---------------------------------------------------------------------------

/** Cislo domu tak, jak ho clovek zna: orientacni kdyz je, jinak popisne. */
function popisCisla(a) {
  if (a.co) return String(a.co) + a.znak;
  return a.cp;
}

/** Klic pro vyhledavani — bez diakritiky a bez mezer navic. */
const zjednodus = (t) =>
  t.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const ulice = [];
const indexUlic = new Map();
for (const a of adresy) {
  const nazev = a.ulice || a.cast;
  if (!indexUlic.has(nazev)) {
    indexUlic.set(nazev, ulice.length);
    ulice.push(nazev);
  }
}

const zaznamy = adresy
  .map((a) => {
    const { lat, lon } = naStupne(a.x, a.y);
    return [
      indexUlic.get(a.ulice || a.cast),
      popisCisla(a),
      a.okrsek,
      Math.round(lat * 1e5) / 1e5,
      Math.round(lon * 1e5) / 1e5,
      a.cast,
    ];
  })
  .sort((p, q) => p[0] - q[0] || String(p[1]).localeCompare(q[1], 'cs', { numeric: true }));

// Casti obce jako samostatny seznam, ať se neopakuji u kazde adresy
const casti = [...new Set(zaznamy.map((z) => z[5]))];
for (const z of zaznamy) z[5] = casti.indexOf(z[5]);

const vysledek = {
  zdroj: {
    nazev: 'ČÚZK — RÚIAN, volební okrsky',
    adresa: ZDROJ,
    licence: 'CC-BY 4.0',
    staženo: new Date().toISOString().slice(0, 10),
  },
  presnostPrevoduM: +nejvetsi.toFixed(2),
  ulice,
  casti,
  hledaci: ulice.map(zjednodus),
  // [index ulice, cislo, okrsek, lat, lon, index casti obce]
  adresy: zaznamy,
};

fs.mkdirSync(path.dirname(CIL), { recursive: true });
fs.writeFileSync(CIL, JSON.stringify(vysledek));

const okrsky = [...new Set(zaznamy.map((z) => z[2]))].sort((a, b) => a - b);
krok('Hotovo: ' + CIL);
info(`adres: ${zaznamy.length}`);
info(`ulic: ${ulice.length}`);
info(`okrsku: ${okrsky.length} (${okrsky[0]}–${okrsky[okrsky.length - 1]})`);
info(`velikost: ${Math.round(fs.statSync(CIL).size / 1024)} kB`);

// ---------------------------------------------------------------------------
// 4. Plochy okrsku pro mapu
// ---------------------------------------------------------------------------
//
// Okrsky nemaji v datech nakreslenou hranici — je z nich jen seznam adres.
// Uzemi se proto odvodi: mapa se pokryje jemnou mrizkou a kazde policko
// dostane okrsek nejblizsi adresy. Sousedni policka stejneho okrsku se pak
// v kazdem radku slouci do jednoho obdelniku, aby vysledek nebyl o statisicich
// tvaru. Je to priblizeni, ne uredni hranice — na mape ale ukaze presne to,
// co clovek potrebuje videt: kde konci "muj" okrsek.

if (!fs.existsSync(VYREZ_JSON)) skonci(`Chybi ${VYREZ_JSON}. Spustte nejdriv nastroje/mapa.mjs.`);
const vyrez = JSON.parse(fs.readFileSync(VYREZ_JSON, 'utf8'));

const BUNKA = 3; // velikost policka v souradnicich mapy (1000 x ~717)
const DOSAH = 55; // dal nez tohle uz adresu za "nejblizsi" nepovazujeme

const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
const yJih = merkator(vyrez.jih);
const MERITKO = vyrez.sirka / (vyrez.vychod - vyrez.zapad);
const naMapu = (lat, lon) => ({
  x: (lon - vyrez.zapad) * MERITKO,
  y: vyrez.vyska - (merkator(lat) - yJih) * (180 / Math.PI) * MERITKO,
});

// Adresy do mrizky, aby hledani nejblizsi nemuselo prochazet vsech 5846
const PRIHRADKA = 60;
const prihradky = new Map();
const bodyMapy = [];
for (const z of zaznamy) {
  const b = naMapu(z[3], z[4]);
  if (b.x < -DOSAH || b.x > vyrez.sirka + DOSAH || b.y < -DOSAH || b.y > vyrez.vyska + DOSAH) continue;
  const zaznam = { x: b.x, y: b.y, okrsek: z[2] };
  bodyMapy.push(zaznam);
  const k = Math.floor(b.x / PRIHRADKA) + ':' + Math.floor(b.y / PRIHRADKA);
  if (!prihradky.has(k)) prihradky.set(k, []);
  prihradky.get(k).push(zaznam);
}

function nejblizsiOkrsek(x, y) {
  const px = Math.floor(x / PRIHRADKA);
  const py = Math.floor(y / PRIHRADKA);
  let nej = null;
  let nejD = DOSAH * DOSAH;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const b of prihradky.get(px + dx + ':' + (py + dy)) ?? []) {
        const d = (b.x - x) ** 2 + (b.y - y) ** 2;
        if (d < nejD) { nejD = d; nej = b.okrsek; }
      }
    }
  }
  return nej;
}

const sloupcu = Math.ceil(vyrez.sirka / BUNKA);
const radku = Math.ceil(vyrez.vyska / BUNKA);
const cesty = new Map(okrsky.map((o) => [o, []]));

for (let r = 0; r < radku; r++) {
  const y = r * BUNKA;
  let zacatek = null;
  let bezici = null;
  for (let s = 0; s <= sloupcu; s++) {
    const o = s < sloupcu ? nejblizsiOkrsek(s * BUNKA + BUNKA / 2, y + BUNKA / 2) : null;
    if (o !== bezici) {
      if (bezici !== null) {
        const x0 = zacatek * BUNKA;
        const sirka = (s - zacatek) * BUNKA;
        cesty.get(bezici).push(`M${x0} ${y}h${sirka}v${BUNKA}h-${sirka}z`);
      }
      bezici = o;
      zacatek = s;
    }
  }
}

const skupiny = okrsky
  .filter((o) => cesty.get(o).length)
  .map((o) => `  <g class="okrsek-plocha" data-okrsek="${o}">\n    <path d="${cesty.get(o).join('')}"/>\n  </g>`);

const svgPlochy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vyrez.sirka} ${vyrez.vyska}" aria-hidden="true" focusable="false">
<!-- Plochy volebnich okrsku, vygenerovane skriptem nastroje/okrsky.mjs.
     Odvozene z adres (CUZK / RUIAN), nejsou to uredni hranice. Needitovat rucne. -->
${skupiny.join('\n')}
</svg>
`;

fs.writeFileSync(CIL_PLOCHY, svgPlochy);
krok('Hotovo: ' + CIL_PLOCHY);
info(`plochy pro ${skupiny.length} okrsku`);
info(`velikost: ${Math.round(fs.statSync(CIL_PLOCHY).size / 1024)} kB`);
