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
 *   public/data/okrsky-plochy.json   plochy okrsku pro mapu na webu
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { VYREZ, MERITKO, merkator } from './vyrez-obce.mjs';

/** Vyrez i jeho prepocet ziji ve `vyrez-obce.mjs`, spolecne s generatorem
    dlazdic. Kdyby si je kazdy skript drzel sam, plochy okrsku by po zmene
    vyrezu sedely jinam nez mapa pod nimi. */
const vyrez = VYREZ;

const KOD_OBCE = '592889'; // Vyskov
const ZDROJ = `https://services.cuzk.gov.cz/sestavy/VO/${KOD_OBCE}.zip`;
const DOCASNE = 'nastroje/.okrsky';
// Data lezi v public/, ne v src/: maji skoro 200 kB a nacita je jen jedna
// stranka. Vlozena do HTML by zbytecne zvetsila kazdou jinou.
const CIL = 'public/data/okrsky.json';
/**
 * Plochy volebnich oblasti pro mapu na webu.
 *
 * Zemepisne souradnice, ne jednotky mapy: mapa se da posouvat a priblizovat,
 * takze tvary pevne k jednomu vyrezu by byly k nicemu. Vykresluje je MapLibre
 * jako vlastni vrstvu nad dlazdicemi.
 */
const CIL_PLOCHY_GEO = 'public/data/okrsky-plochy.json';
// Sirsi mapa cele obce — okrsky 24 a 25 (Rychtarov, Lhota) lezi mimo
// tesny vyrez mesta a na te uzsi mape by je nikdo nenasel.
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

// Jemnost mrizky v souradnicich mapy. Jedna jednotka je asi deset metru,
// takze bunka vyjde zhruba na sirku jednoho domu - jemneji uz nema smysl,
// hranice stejne obchazi domy podle jejich obrysu.
const BUNKA = 1;
// Jak daleko od domu jeste plocha saha. Jedna jednotka mapy je asi deset
// metru, takze dvacet je zhruba dve ste. Driv to bylo sedesat, tedy pres
// pul kilometru - plochy se pak roztahovaly hluboko do poli, kde nikdo
// nebydli. Presah tam byt ma, at oblast nekonci na prahu krajniho domu,
// ale ne takovy.
const DOSAH = 20;
const ZOOM_DLAZDIC = 14; // nejvetsi stazeny zoom, tam jsou obrysy domu

const yJih = merkator(vyrez.jih);
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
function zmerShodu(popis) {
  let sedi = 0;
  const rozchazi = new Map();
  for (const z of zaznamy) {
    const b = naMapu(z.lat, z.lon);
    const s = Math.floor(b.x / BUNKA);
    const r = Math.floor(b.y / BUNKA);
    if (hodnota(s, r) === (okrsekNaBudovu.get(z.o) ?? 0)) sedi++;
    else {
      const k = ulice[z.u] || z.c;
      rozchazi.set(k, (rozchazi.get(k) ?? 0) + 1);
    }
  }
  const podil = (100 * sedi) / zaznamy.length;
  info(`${popis}: ${sedi} z ${zaznamy.length} (${podil.toFixed(1)} %)`);
  if (rozchazi.size) {
    const nejhorsi = [...rozchazi].sort((a, b) => b[1] - a[1]).slice(0, 6);
    info('  rozchazi se: ' + nejhorsi.map(([u, n]) => `${u} (${n})`).join(', '));
  }
  return podil;
}

// Nejdriv jak dopadlo samotne hlasovani sousednich adres. Je to mira toho,
// jak dobre se odhaduje prostor MEZI domy — tam zadny obrys nepomuze.
zmerShodu('domu ve spravne barve po hlasovani');

// --- Obrysy domu z nasich dlazdic -----------------------------------------
//
// Mrizka sama o sobe vede hranici oblasti tudy, kudy zrovna vyjde hlasovani
// nejblizsich adres — a ta obcas prochazi PRESTRED domu. Na mape to je videt
// na prvni pohled: pulka domu jedna barva, pulka druha. Obcas dopadne cely
// dum spatne, protoze ho prehlasuji hustejsi sousedi za rohem.
//
// Obrysy domu mame v dlazdicich, ktere uz v repozitari lezi kvuli mape.
// Kazdy dum se tedy dohleda, priradi se mu okrsek podle adres, ktere v nem
// jsou, a do mrizky se OTISKNE cely. Hranice pak dum vzdycky obejde.

/** Nacte obrysy domu ze vsech stazenych dlazdic nejvetsiho zoomu. */
function nactiDomy() {
  const korenDlazdic = 'public/dlazdice/' + ZOOM_DLAZDIC;
  if (!fs.existsSync(korenDlazdic)) {
    skonci('Chybi ' + korenDlazdic + '. Spustte nejdriv nastroje/dlazdice.mjs.');
  }

  const domy = [];
  for (const sloupec of fs.readdirSync(korenDlazdic)) {
    const x = Number(sloupec);
    if (!Number.isFinite(x)) continue;
    for (const soubor of fs.readdirSync(path.join(korenDlazdic, sloupec))) {
      if (!soubor.endsWith('.pbf')) continue;
      const y = Number(soubor.slice(0, -4));
      const dlazdice = new VectorTile(
        new Pbf(fs.readFileSync(path.join(korenDlazdic, sloupec, soubor))),
      );
      const vrstva = dlazdice.layers.building;
      if (!vrstva) continue;

      for (let i = 0; i < vrstva.length; i++) {
        const tvar = vrstva.feature(i).toGeoJSON(x, y, ZOOM_DLAZDIC);
        const kusy =
          tvar.geometry.type === 'Polygon'
            ? [tvar.geometry.coordinates]
            : tvar.geometry.coordinates;
        for (const kus of kusy) {
          // Diry uvnitr domu nas nezajimaji, staci vnejsi obrys.
          const obrys = kus[0].map(([lon, lat]) => {
            const b = naMapu(lat, lon);
            return [b.x, b.y];
          });
          if (obrys.length < 4) continue;
          domy.push({ obrys, ram: ramObrysu(obrys), budova: 0 });
        }
      }
    }
  }
  return domy;
}

function ramObrysu(obrys) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of obrys) {
    if (x < x1) x1 = x;
    if (x > x2) x2 = x;
    if (y < y1) y1 = y;
    if (y > y2) y2 = y;
  }
  return { x1, y1, x2, y2 };
}

/** Lezi bod uvnitr obrysu? Klasicky paprsek doprava. */
function vObrysu(x, y, obrys) {
  let uvnitr = false;
  for (let i = 0, j = obrys.length - 1; i < obrys.length; j = i++) {
    const [xi, yi] = obrys[i];
    const [xj, yj] = obrys[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) uvnitr = !uvnitr;
  }
  return uvnitr;
}

const domy = nactiDomy();

// Prihradky pres ramy domu, aby se ke kazde adrese nehledalo mezi vsemi.
const PRIHRADKA_DOMU = 20;
const prihradkyDomu = new Map();
for (const dum of domy) {
  for (let px = Math.floor(dum.ram.x1 / PRIHRADKA_DOMU); px <= Math.floor(dum.ram.x2 / PRIHRADKA_DOMU); px++) {
    for (let py = Math.floor(dum.ram.y1 / PRIHRADKA_DOMU); py <= Math.floor(dum.ram.y2 / PRIHRADKA_DOMU); py++) {
      const klic = px + ':' + py;
      if (!prihradkyDomu.has(klic)) prihradkyDomu.set(klic, []);
      prihradkyDomu.get(klic).push(dum);
    }
  }
}

/**
 * Ke ktere adrese dum patri.
 *
 * Adresni bod z RUIAN nelezi vzdycky uvnitr obrysu z OpenStreetMap — obojí
 * kresli nekdo jiny a par metru se to rozchazi. Proto se nejdriv zkousi
 * obrys a teprve kdyz bod nikam nepadne, vezme se nejblizsi dum do ODSTUP.
 */
const ODSTUP_ADRESY = 1.2; // v jednotkach mapy, tedy asi 12 metru

function domProAdresu(x, y) {
  const okoli = new Set();
  const px = Math.floor(x / PRIHRADKA_DOMU);
  const py = Math.floor(y / PRIHRADKA_DOMU);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const dum of prihradkyDomu.get(px + dx + ':' + (py + dy)) ?? []) okoli.add(dum);
    }
  }
  let nejblizsi = null;
  let nejD = ODSTUP_ADRESY * ODSTUP_ADRESY;
  for (const dum of okoli) {
    if (x >= dum.ram.x1 && x <= dum.ram.x2 && y >= dum.ram.y1 && y <= dum.ram.y2) {
      if (vObrysu(x, y, dum.obrys)) return dum;
    }
    // Vzdalenost k ramu staci - obrysy domu jsou skoro obdelniky.
    const dx = Math.max(dum.ram.x1 - x, 0, x - dum.ram.x2);
    const dy = Math.max(dum.ram.y1 - y, 0, y - dum.ram.y2);
    const d = dx * dx + dy * dy;
    if (d < nejD) {
      nejD = d;
      nejblizsi = dum;
    }
  }
  return nejblizsi;
}

// Kazdemu domu se priradi volebni budova podle adres, ktere v nem jsou.
// Kdyz jich ma vic z ruznych okrsku (bytovy dum na rohu), rozhodne vetsina.
const hlasyDomu = new Map();
for (const z of zaznamy) {
  const b = naMapu(z.lat, z.lon);
  const dum = domProAdresu(b.x, b.y);
  if (!dum) continue;
  if (!hlasyDomu.has(dum)) hlasyDomu.set(dum, new Map());
  const hlasy = hlasyDomu.get(dum);
  const budova = okrsekNaBudovu.get(z.o) ?? 0;
  hlasy.set(budova, (hlasy.get(budova) ?? 0) + 1);
}

let sAdresou = 0;
for (const [dum, hlasy] of hlasyDomu) {
  let vitez = 0;
  let nejvic = 0;
  for (const [budova, pocet] of hlasy) {
    if (pocet > nejvic) {
      nejvic = pocet;
      vitez = budova;
    }
  }
  dum.budova = vitez;
  if (vitez) sAdresou++;
}

/** Otiskne obrysy domu do mrizky. Dum uz hranice oblasti nerozdeli. */
function otiskniDomy() {
  let bunek = 0;
  for (const dum of domy) {
    if (!dum.budova) continue;
    const odS = Math.max(0, Math.floor(dum.ram.x1 / BUNKA));
    const doS = Math.min(sloupcu - 1, Math.floor(dum.ram.x2 / BUNKA));
    const odR = Math.max(0, Math.floor(dum.ram.y1 / BUNKA));
    const doR = Math.min(radkuM - 1, Math.floor(dum.ram.y2 / BUNKA));

    let trefeno = 0;
    for (let s = odS; s <= doS; s++) {
      for (let r = odR; r <= doR; r++) {
        // Nestaci se ptat na stred bunky. Bezny dum je uzsi nez bunka, takze
        // by se do zadneho stredu netrefil a hranice by mu porad mohla vest
        // pres strechu. Otiskne se proto kazda bunka, ktere se dum aspon
        // dotkne — hranice pak vede vedle domu, ne skrz nej.
        const x = s * BUNKA;
        const y = r * BUNKA;
        const dotyka =
          vObrysu(x + BUNKA / 2, y + BUNKA / 2, dum.obrys) ||
          vObrysu(x, y, dum.obrys) ||
          vObrysu(x + BUNKA, y, dum.obrys) ||
          vObrysu(x, y + BUNKA, dum.obrys) ||
          vObrysu(x + BUNKA, y + BUNKA, dum.obrys) ||
          // Dum mensi nez bunka lezi celý uvnitr a zadny jeji roh netrefi.
          (dum.ram.x1 >= x && dum.ram.x2 <= x + BUNKA &&
            dum.ram.y1 >= y && dum.ram.y2 <= y + BUNKA);
        if (!dotyka) continue;
        mrizka[r * sloupcu + s] = dum.budova;
        trefeno++;
      }
    }

    // Maly dum se nemusi trefit do zadneho stredu bunky. Aby ani ten nezustal
    // rozpuleny, otiskne se u nej aspon bunka, ve ktere lezi jeho stred.
    if (!trefeno) {
      const s = Math.min(sloupcu - 1, Math.max(0, Math.floor((dum.ram.x1 + dum.ram.x2) / 2 / BUNKA)));
      const r = Math.min(radkuM - 1, Math.max(0, Math.floor((dum.ram.y1 + dum.ram.y2) / 2 / BUNKA)));
      mrizka[r * sloupcu + s] = dum.budova;
      trefeno = 1;
    }
    bunek += trefeno;
  }
  return bunek;
}

const otisknutych = otiskniDomy();
info('domu z dlazdic: ' + domy.length + ', z toho s adresou: ' + sAdresou);
info('  otisknuto bunek: ' + otisknutych);

// A ted to, co uvidi lidi. Tohle uz je ostra podminka: kdyby nesedelo,
// ukazovali bychom nekomu cizi volebni mistnost.
const podil = zmerShodu('domu ve spravne barve na mape');
if (podil < 99.5) {
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

/**
 * Vyhodi body, ktere lezi uprostred rovneho useku.
 *
 * Vytrasovany obrys jde po hranach bunek, takze je plny zbytecnych bodu -
 * kazda rovna cast ma bod na kazdem kroku mrizky. Slouceni je BEZE ZTRATY:
 * cara vede presne tudy co predtim, jen se popise mene body.
 *
 * A prave proto se obrysy nijak jinak nezjednodusuji ani nevyhlazuji.
 * Kazda oblast se zpracovava zvlast, takze jakakoliv zmena tvaru by dve
 * sousedni oblasti rozvedla: spolecna hranice by se u kazde z nich ohnula
 * jinam a mezi plochami by vznikly mezery a prekryvy. Presne to se na mape
 * delo. Rovne schodovite hranice jsou mene efektni, ale sedi.
 */
function slucRovne(body) {
  const b = body.slice();
  // Trasovani vraci smycku, ktera konci tam, kde zacala.
  if (b.length > 1 && b[0][0] === b[b.length - 1][0] && b[0][1] === b[b.length - 1][1]) b.pop();
  const n = b.length;
  if (n < 3) return null;

  const vysledek = [];
  for (let i = 0; i < n; i++) {
    const pred = b[(i - 1 + n) % n];
    const ted = b[i];
    const po = b[(i + 1) % n];
    // Vektorovy soucin nulovy = tri body v rade.
    const vRade =
      (ted[0] - pred[0]) * (po[1] - ted[1]) === (ted[1] - pred[1]) * (po[0] - ted[0]);
    if (!vRade) vysledek.push(ted);
  }
  return vysledek.length >= 3 ? vysledek : null;
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

/** Opacny smer k `merkator` - z polohy na mape zpatky na zemepisne souradnice. */
const zMerkatoru = (y) => 2 * Math.atan(Math.exp(y)) - Math.PI / 2;

/** Bod mapy -> [delka, sirka]. Pet desetinnych mist je zhruba metr. */
function naZemekouli([x, y]) {
  const lon = vyrez.zapad + x / MERITKO;
  const lat = (zMerkatoru(yJih + ((vyrez.vyska - y) / MERITKO) * (Math.PI / 180)) * 180) / Math.PI;
  return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

/** Plocha se znamenkem. Vnitrni smycka se toci opacne nez vnejsi. */
function plochaSmycky(body) {
  let dvojnasobek = 0;
  for (let i = 0; i < body.length; i++) {
    const [x1, y1] = body[i];
    const [x2, y2] = body[(i + 1) % body.length];
    dvojnasobek += x1 * y2 - x2 * y1;
  }
  return dvojnasobek / 2;
}

/** Lezi bod uvnitr smycky? Klasicky paprsek doprava. */
function uvnitrSmycky([x, y], smycka) {
  let uvnitr = false;
  for (let i = 0, j = smycka.length - 1; i < smycka.length; j = i++) {
    const [xi, yi] = smycka[i];
    const [xj, yj] = smycka[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) uvnitr = !uvnitr;
  }
  return uvnitr;
}

const plochyGeo = [];
let celkemBodu = 0;

for (const o of cisla) {
  const smycky = obrysy(o).map(slucRovne).filter(Boolean);
  if (!smycky.length) continue;
  for (const s of smycky) celkemBodu += s.length;

  const b = budovy[o - 1];

  // Diry. Obrysy jsou vedene tak, ze uvnitr oblasti je vpravo od smeru chuze,
  // takze vnitrni smycka se toci opacne nez vnejsi. V SVG to resi pravidlo
  // `nonzero` samo, GeoJSON ale chce diry vyjmenovane u toho prstence, do
  // ktereho patri - jinak by se vnitrni dvory vyplnily barvou.
  const kridla = smycky;
  const vnejsi = kridla.filter((k) => plochaSmycky(k) > 0);
  const diry = kridla.filter((k) => plochaSmycky(k) <= 0);

  const mnohouhelniky = vnejsi.map((k) => [k]);
  for (const dira of diry) {
    const kam = mnohouhelniky.find((m) => uvnitrSmycky(dira[0], m[0]));
    // Dira, ktera nelezi v zadnem prstenci teze oblasti, je chyba trasovani.
    // Zahodit ji je mensi zlo nez ji pripsat nahodne plose.
    if (kam) kam.push(dira);
  }
  if (!mnohouhelniky.length) continue;

  plochyGeo.push({
    type: 'Feature',
    properties: { budova: o - 1, okrsky: b.okrsky.join(' '), barva: barvy.get(o) },
    geometry: {
      type: 'MultiPolygon',
      coordinates: mnohouhelniky.map((m) =>
        m.map((prstenec) => {
          const body = prstenec.map(naZemekouli);
          // GeoJSON chce prstenec uzavreny - prvni bod se musi zopakovat.
          body.push(body[0]);
          return body;
        }),
      ),
    },
  });
}

fs.writeFileSync(
  CIL_PLOCHY_GEO,
  JSON.stringify({ type: 'FeatureCollection', features: plochyGeo }),
);


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
info(`${CIL_PLOCHY_GEO}  (${Math.round(fs.statSync(CIL_PLOCHY_GEO).size / 1024)} kB)`);
info(`  ploch: ${plochyGeo.length} (budov), bodu obrysu: ${celkemBodu}, barev: ${new Set(barvy.values()).size}`);
