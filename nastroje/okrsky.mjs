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
 * Vysledky (obojí se commituje, web uz nikam nesaha):
 *   public/data/okrsky.json   adresy pro vyhledavac
 *   public/mapa-okrsky.svg    plochy okrsku jako skutecne vektorove obrysy
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
const MISTNOSTI_JSON = 'src/lib/volebni-mistnosti.json';
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
    const co = cislo(s[S.co]);
    return {
      cast: (s[S.cast] || '').trim(),
      ulice: (s[S.ulice] || '').trim(),
      cp: (s[S.cp] || '').trim(),
      co: co ? co + (s[S.znak] || '').trim() : '',
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
// 3. Adresy pro vyhledavac
// ---------------------------------------------------------------------------
//
// Ukladaji se OBE cisla — orientacni i popisne. Nekdo zna svuj dum podle
// jednoho, nekdo podle druheho a vyhledavac musi najit obe.

const ulice = [];
const indexUlic = new Map();
for (const a of adresy) {
  const nazev = a.ulice || a.cast;
  if (!indexUlic.has(nazev)) {
    indexUlic.set(nazev, ulice.length);
    ulice.push(nazev);
  }
}

const zaznamy = adresy.map((a) => {
  const { lat, lon } = naStupne(a.x, a.y);
  return {
    u: indexUlic.get(a.ulice || a.cast),
    co: a.co,          // cislo orientacni ("12", "12a") nebo prazdne
    cp: a.cp,          // cislo popisne
    o: a.okrsek,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    c: a.cast,
  };
});

const casti = [...new Set(zaznamy.map((z) => z.c))];
const okrsky = [...new Set(zaznamy.map((z) => z.o))].sort((a, b) => a - b);

// Pole misto objektu — pri 5846 adresach usetri desitky kilobajtu.
const adresyKompaktne = zaznamy
  .map((z) => [z.u, z.co, z.cp, z.o, z.lat, z.lon, casti.indexOf(z.c)])
  .sort((p, q) => p[0] - q[0] || String(p[2]).localeCompare(String(q[2]), 'cs', { numeric: true }));

// ---------------------------------------------------------------------------
// 4. Plochy okrsku jako vektorove obrysy
// ---------------------------------------------------------------------------
//
// Okrsky nemaji v datech nakreslenou hranici — je z nich jen seznam adres.
// Uzemi se proto odvodi: mapa se pokryje mrizkou a kazde policko dostane
// okrsek nejblizsi adresy. Z mrizky se pak VYTRASUJE obrys a zjednodusi,
// takze vysledkem jsou skutecne mnohouhelniky, ne schody z ctverecku.
// Diky tomu mapa zustava ostra i pri zvetseni.
//
// Je to priblizeni, ne uredni hranice — na mape ale ukaze presne to, co clovek
// potrebuje videt: kde konci "muj" okrsek.

if (!fs.existsSync(VYREZ_JSON)) skonci(`Chybi ${VYREZ_JSON}. Spustte nejdriv nastroje/mapa.mjs.`);
const vyrez = JSON.parse(fs.readFileSync(VYREZ_JSON, 'utf8'));

// Plochy se kresli po BUDOVACH, ne po okrscich. Volice nezajima cislo okrsku,
// ale do ktere budovy ma jit — a kdyz nekolik okrsku voli na stejnem miste,
// jsou to z jeho pohledu jedna oblast. Slouceni uz pri rasterizaci navic
// odstrani vnitrni hranice, ktere by jinak zbytecne delily jednu oblast.
if (!fs.existsSync(MISTNOSTI_JSON)) skonci(`Chybi ${MISTNOSTI_JSON}.`);
const mistnostiZdroj = JSON.parse(fs.readFileSync(MISTNOSTI_JSON, 'utf8')).mistnosti;

const budovy = [];
const okrsekNaBudovu = new Map();
for (const m of mistnostiZdroj) {
  const klic = m.nazev + '|' + m.adresa;
  let i = budovy.findIndex((b) => b.klic === klic);
  if (i < 0) {
    i = budovy.length;
    budovy.push({ klic, nazev: m.nazev, adresa: m.adresa, bezbarierovy: m.bezbarierovy, poznamka: m.poznamka ?? null, okrsky: [] });
  }
  budovy[i].okrsky.push(m.okrsek);
  // Cislujeme od 1, aby 0 mohla znamenat "mimo dosah adres".
  okrsekNaBudovu.set(m.okrsek, i + 1);
}

const chybejici = okrsky.filter((o) => !okrsekNaBudovu.has(o));
if (chybejici.length) {
  skonci(`Okrsky ${chybejici.join(', ')} nemaji ve ${MISTNOSTI_JSON} volebni mistnost.`);
}

const BUNKA = 2;      // jemnost mrizky v souradnicich mapy
const DOSAH = 60;     // dal nez tohle uz adresu za "nejblizsi" nepovazujeme
const TOLERANCE = 1.6; // jak moc se smi obrys zjednodusit

const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
const yJih = merkator(vyrez.jih);
const MERITKO = vyrez.sirka / (vyrez.vychod - vyrez.zapad);
const naMapu = (lat, lon) => ({
  x: (lon - vyrez.zapad) * MERITKO,
  y: vyrez.vyska - (merkator(lat) - yJih) * (180 / Math.PI) * MERITKO,
});

krok('Odvozuji plochy okrsku.');

const PRIHRADKA = 60;
const prihradky = new Map();
for (const z of zaznamy) {
  const b = naMapu(z.lat, z.lon);
  const k = Math.floor(b.x / PRIHRADKA) + ':' + Math.floor(b.y / PRIHRADKA);
  if (!prihradky.has(k)) prihradky.set(k, []);
  prihradky.get(k).push({ x: b.x, y: b.y, budova: okrsekNaBudovu.get(z.o) ?? 0 });
}

/**
 * Ke ktere budove policko patri.
 *
 * NEstaci vzit jedinou nejblizsi adresu. Ulice jsou ve meste proplete: treba
 * Kasikova patri cela ke knihovne, ale ze vsech stran ji lemuji domy z Nadrazni,
 * Nerudovy a II. odboje, ktere patri jinam a lezi bliz (18-35 m) nez sousedni
 * dum na same Kasikove (31 m). Pri rozhodovani podle jedine nejblizsi adresy
 * ulici okoli "seralo" a zbyly z ni ostruvky u jednotlivych domu.
 *
 * Hlasuje proto NEKOLIK nejblizsich adres s vahou 1/d^2. Uprostred ulice tak
 * prevazi nekolik jejich vlastnich domu nad jednim cizim, ktery je shodou
 * okolnosti o par metru bliz.
 */
const HLASUJICICH = 8;

function budovaProBunku(x, y) {
  const px = Math.floor(x / PRIHRADKA);
  const py = Math.floor(y / PRIHRADKA);

  // Nejblizsi adresy: staci si drzet HLASUJICICH nejlepsich, seznam je kratky.
  const nejlepsi = [];
  let nejD = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const b of prihradky.get(px + dx + ':' + (py + dy)) ?? []) {
        const d = (b.x - x) ** 2 + (b.y - y) ** 2;
        if (d > DOSAH * DOSAH) continue;
        if (d < nejD) nejD = d;
        if (nejlepsi.length < HLASUJICICH) {
          nejlepsi.push({ d, budova: b.budova });
        } else {
          let nejhorsi = 0;
          for (let i = 1; i < nejlepsi.length; i++) {
            if (nejlepsi[i].d > nejlepsi[nejhorsi].d) nejhorsi = i;
          }
          if (d < nejlepsi[nejhorsi].d) nejlepsi[nejhorsi] = { d, budova: b.budova };
        }
      }
    }
  }

  if (!nejlepsi.length) return 0; // mimo dosah jakekoliv adresy

  // Vaha 1/d^2, aby blizsi adresy rozhodovaly vyrazneji. Konstanta v jmenovateli
  // brani tomu, aby jedina adresa presne pod polickem prehlasila vsechny ostatni.
  const hlasy = new Map();
  for (const n of nejlepsi) {
    const vaha = 1 / (n.d + 9);
    hlasy.set(n.budova, (hlasy.get(n.budova) ?? 0) + vaha);
  }

  let vitez = 0;
  let nejvic = -1;
  for (const [budova, vaha] of hlasy) {
    if (vaha > nejvic) {
      nejvic = vaha;
      vitez = budova;
    }
  }
  return vitez;
}

const sloupcu = Math.ceil(vyrez.sirka / BUNKA);
const radkuM = Math.ceil(vyrez.vyska / BUNKA);
const mrizka = new Int16Array(sloupcu * radkuM);
for (let r = 0; r < radkuM; r++) {
  for (let s = 0; s < sloupcu; s++) {
    mrizka[r * sloupcu + s] = budovaProBunku(s * BUNKA + BUNKA / 2, r * BUNKA + BUNKA / 2);
  }
}

const hodnota = (s, r) => (s < 0 || r < 0 || s >= sloupcu || r >= radkuM ? 0 : mrizka[r * sloupcu + s]);

// --- Kontrola: sedi barva pod kazdym domem? --------------------------------
// Primy test toho, co clovek na mape overuje: "je muj dum v te spravne barve?"
// Kdyz se to rozejde, je neco spatne v rasterizaci a radeji to rekneme nahlas,
// nez aby web ukazoval lidem cizi volebni mistnost.
let sedi = 0;
const rozchazi = new Map();
for (const z of zaznamy) {
  const b = naMapu(z.lat, z.lon);
  const s = Math.floor(b.x / BUNKA);
  const r = Math.floor(b.y / BUNKA);
  const ocekavano = (okrsekNaBudovu.get(z.o) ?? 0);
  if (hodnota(s, r) === ocekavano) sedi++;
  else {
    const k = ulice[z.u] || z.c;
    rozchazi.set(k, (rozchazi.get(k) ?? 0) + 1);
  }
}
const podil = (100 * sedi) / zaznamy.length;
info(`domu ve spravne barve: ${sedi} z ${zaznamy.length} (${podil.toFixed(1)} %)`);
if (rozchazi.size) {
  const nejhorsi = [...rozchazi].sort((a, b) => b[1] - a[1]).slice(0, 6);
  info('rozchazi se: ' + nejhorsi.map(([u, n]) => `${u} (${n})`).join(', '));
}
if (podil < 97) {
  skonci(`Na mape by mel ${(100 - podil).toFixed(1)} % domu spatnou barvu. Data se nezapsala.`);
}

/**
 * Vytrasuje obrysy jedne hodnoty v mrizce.
 * Posbira hranicni hrany policek a spoji je do uzavrenych smycek.
 */
function obrysy(cil) {
  // Z jednoho bodu muze vychazet VIC hran — stava se to tam, kde se dve casti
  // teze oblasti dotykaji jen rohem. Kdyz se drzela jen jedna, smycky se
  // v tom miste splacly dohromady a v obrysu vznikla prelozena cara, ktera
  // pres oblast vedla napric.
  const hrany = new Map(); // "x,y" pocatku -> pole koncu
  const pridej = (x1, y1, x2, y2) => {
    const k = x1 + ',' + y1;
    if (!hrany.has(k)) hrany.set(k, []);
    hrany.get(k).push([x2, y2]);
  };

  for (let r = 0; r < radkuM; r++) {
    for (let s = 0; s < sloupcu; s++) {
      if (hodnota(s, r) !== cil) continue;
      const x = s * BUNKA;
      const y = r * BUNKA;
      // Smer hran drzi jednotne otaceni, aby na sebe navazovaly.
      if (hodnota(s, r - 1) !== cil) pridej(x, y, x + BUNKA, y);
      if (hodnota(s + 1, r) !== cil) pridej(x + BUNKA, y, x + BUNKA, y + BUNKA);
      if (hodnota(s, r + 1) !== cil) pridej(x + BUNKA, y + BUNKA, x, y + BUNKA);
      if (hodnota(s - 1, r) !== cil) pridej(x, y + BUNKA, x, y);
    }
  }

  /**
   * Ze vsech hran vychazejicich z bodu vybere tu, ktera zatoci nejvic doprava.
   * Hrany jsou vedene tak, ze uvnitr oblasti je vpravo od smeru chuze —
   * drzet se pri rozcesti vpravo tedy obchazi prave tu cast, ve ktere jsme,
   * a druhou necha na samostatnou smycku.
   */
  function dalsi(klic, prichozi) {
    const moznosti = hrany.get(klic);
    if (!moznosti || !moznosti.length) return null;
    if (moznosti.length === 1) return moznosti.splice(0, 1)[0];

    const [px, py] = klic.split(',').map(Number);
    let nejI = 0;
    let nejPoradi = -Infinity;
    for (let i = 0; i < moznosti.length; i++) {
      const sx = Math.sign(moznosti[i][0] - px);
      const sy = Math.sign(moznosti[i][1] - py);
      // Uhel otoceni vuci prichozimu smeru: vektorovy soucin urcuje stranu,
      // skalarni rozlisi rovne od otocky o 180 stupnu.
      const kriz = prichozi[0] * sy - prichozi[1] * sx;
      const skalar = prichozi[0] * sx + prichozi[1] * sy;
      // Poradi od nejostrejsi pravotocive zatacky po otocku zpet.
      const poradi = kriz > 0 ? 3 - skalar : kriz < 0 ? 1 - skalar : skalar > 0 ? 2 : 0;
      if (poradi > nejPoradi) {
        nejPoradi = poradi;
        nejI = i;
      }
    }
    return moznosti.splice(nejI, 1)[0];
  }

  const smycky = [];
  let zbyva = 0;
  for (const v of hrany.values()) zbyva += v.length;

  while (zbyva > 0) {
    let klic = null;
    for (const [k, v] of hrany) {
      if (v.length) {
        klic = k;
        break;
      }
    }
    if (!klic) break;

    const smycka = [];
    let prichozi = [1, 0];
    while (true) {
      const dal = dalsi(klic, prichozi);
      if (!dal) break;
      zbyva--;
      const [px, py] = klic.split(',').map(Number);
      prichozi = [Math.sign(dal[0] - px), Math.sign(dal[1] - py)];
      smycka.push(dal);
      klic = dal[0] + ',' + dal[1];
    }
    if (smycka.length > 3) smycky.push(smycka);
  }
  return smycky;
}

/** Douglas–Peucker: ze schodu udela primky a rohy. */
function zjednodus(body, tolerance) {
  if (body.length < 3) return body;
  const vzdalenostOdUsecky = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const delka = dx * dx + dy * dy;
    if (!delka) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / delka;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const rekurze = (od, do_) => {
    let nejD = 0;
    let nejI = -1;
    for (let i = od + 1; i < do_; i++) {
      const d = vzdalenostOdUsecky(body[i], body[od], body[do_]);
      if (d > nejD) { nejD = d; nejI = i; }
    }
    if (nejD > tolerance) return [...rekurze(od, nejI), ...rekurze(nejI, do_).slice(1)];
    return [body[od], body[do_]];
  };
  return rekurze(0, body.length - 1);
}

/** Sousedi okrsku — pro obarveni tak, aby dva sousedni nemely stejnou barvu. */
const cisla = budovy.map((_, i) => i + 1);
const sousede = new Map(cisla.map((c) => [c, new Set()]));
for (let r = 0; r < radkuM; r++) {
  for (let s = 0; s < sloupcu; s++) {
    const a = hodnota(s, r);
    if (!a) continue;
    for (const [ds, dr] of [[1, 0], [0, 1]]) {
      const b = hodnota(s + ds, r + dr);
      if (b && b !== a) {
        sousede.get(a)?.add(b);
        sousede.get(b)?.add(a);
      }
    }
  }
}

// Hladove barveni: okrsky s nejvic sousedy se resi prvni.
const POCET_BAREV = 6;
const barvy = new Map();
for (const o of [...cisla].sort((p, q) => (sousede.get(q)?.size ?? 0) - (sousede.get(p)?.size ?? 0))) {
  const obsazene = new Set([...(sousede.get(o) ?? [])].map((s) => barvy.get(s)).filter((b) => b != null));
  let barva = 0;
  while (obsazene.has(barva) && barva < POCET_BAREV - 1) barva++;
  barvy.set(o, barva);
}

/**
 * Prolozi mnohouhelnik hladkou krivkou.
 *
 * Obrys vytrasovany z mrizky ma na sikmych usecich schody. Douglas-Peucker
 * z nich udela lomenou caru, ale porad jsou videt zuby. Kvadraticke krivky
 * vedene STREDY hran, kde vrcholy slouzi jako ridici body, zuby zaobli
 * a pritom nepridaji ani jeden bod navic.
 */
function vyhlad(body) {
  // Trasovani vraci smycku, ktera konci tam, kde zacala.
  const b = body.slice();
  if (b.length > 1 && b[0][0] === b[b.length - 1][0] && b[0][1] === b[b.length - 1][1]) b.pop();
  const n = b.length;
  if (n < 3) return null;

  const zaokrouhli = ([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  const stred = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

  let d = 'M' + zaokrouhli(stred(b[0], b[1]));
  for (let i = 1; i <= n; i++) {
    const vrchol = b[i % n];
    const dalsi = b[(i + 1) % n];
    d += 'Q' + zaokrouhli(vrchol) + ' ' + zaokrouhli(stred(vrchol, dalsi));
  }
  return d + 'Z';
}

const skupiny = [];
let celkemBodu = 0;
for (const o of cisla) {
  const cesty = obrysy(o)
    .map((smycka) => zjednodus(smycka, TOLERANCE))
    .filter((s) => s.length > 3)
    .map((s) => {
      celkemBodu += s.length;
      return vyhlad(s);
    })
    .filter(Boolean);
  if (!cesty.length) continue;
  const b = budovy[o - 1];
  skupiny.push(
    `  <g class="budova-plocha" data-budova="${o - 1}" data-okrsky="${b.okrsky.join(' ')}" data-barva="${barvy.get(o)}">\n` +
      `    <path d="${cesty.join('')}"/>\n  </g>`,
  );
}

const svgPlochy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vyrez.sirka} ${vyrez.vyska}" aria-hidden="true" focusable="false">
<!-- Plochy volebnich okrsku, vygenerovane skriptem nastroje/okrsky.mjs.
     Jedna plocha = jedna volebni budova (nekolik okrsku muze volit na stejnem
     miste). Odvozene z adres (CUZK / RUIAN), nejsou to uredni hranice.
     Needitovat rucne. -->
${skupiny.join('\n')}
</svg>
`;

fs.writeFileSync(CIL_PLOCHY, svgPlochy);

// ---------------------------------------------------------------------------
// 5. Zapis
// ---------------------------------------------------------------------------

const vysledek = {
  zdroj: {
    nazev: 'ČÚZK — RÚIAN, volební okrsky',
    adresa: ZDROJ,
    licence: 'CC-BY 4.0',
    stazeno: new Date().toISOString().slice(0, 10),
  },
  presnostPrevoduM: +nejvetsi.toFixed(2),
  ulice,
  casti,
  budovy: budovy.map((b, i) => ({ ...b, barva: barvy.get(i + 1) ?? 0 })),
  okrsekNaBudovu: Object.fromEntries([...okrsekNaBudovu].map(([o, i]) => [o, i - 1])),
  // [index ulice, cislo orientacni, cislo popisne, okrsek, lat, lon, index casti]
  adresy: adresyKompaktne,
};

fs.mkdirSync(path.dirname(CIL), { recursive: true });
fs.writeFileSync(CIL, JSON.stringify(vysledek));

krok('Hotovo.');
info(`${CIL}  (${Math.round(fs.statSync(CIL).size / 1024)} kB)`);
info(`  adres: ${adresyKompaktne.length}, ulic: ${ulice.length}, okrsku: ${okrsky.length}`);
info(`${CIL_PLOCHY}  (${Math.round(fs.statSync(CIL_PLOCHY).size / 1024)} kB)`);
info(`  ploch: ${skupiny.length} (budov), bodu obrysu: ${celkemBodu}, barev: ${new Set(barvy.values()).size}`);
