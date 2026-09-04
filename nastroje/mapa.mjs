/**
 * Vyrobi podkladove mapy jako SVG:  node nastroje/mapa.mjs
 *
 * Data se stahuji z OpenStreetMap pres Overpass API. Delaji se JEDNOU
 * a vysledek se commituje, takze hotovy web uz nikam nesaha - zadna mapova
 * sluzba, zadne trackovani navstevniku, zadne cekani na cizi server.
 * To je u strany s timhle nazvem podstatne.
 *
 * Vyrabi se dve mapy, protoze kazda ma jiny ukol:
 *
 *   mesto  - tesny orez kolem Vyskova pro mapu zameru. Mistni casti se do nej
 *            nevejdou, ale zamery jsou stejne vsechny ve meste a na sirsim
 *            zaberu by se mesto ztratilo.
 *   obec   - cele uzemi obce vcetne Rychtarova, Lhoty a Opatovic pro mapu
 *            volebnich okrsku. Tam musi byt videt uplne vsechny okrsky,
 *            jinak by nekteri lide svuj na mape nenasli.
 *
 * SVG zamerne neobsahuje zadne barvy. Vsechno se obarvuje az v CSS pres tridy,
 * aby mapa sedla do tmaveho pasu i na svetle pozadi.
 *
 * Data (c) prispevatele OpenStreetMap, licence ODbL.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SIRKA = 1000;

const MAPY = [
  {
    nazev: 'mesto',
    // Jizni okraj rezne rybniky Kacenec (mistne Kacak) v polovine. Je to
    // schvalne: kdyby vyrez sahal az pod ne, mapa by byla o sedminu vyssi
    // a mesto v ni mensi. Z Kacence je videt kus a bod klimaparku se nad
    // nej vejde, coz staci.
    vyrez: { jih: 49.2636, sever: 49.3024, zapad: 16.9485, vychod: 17.0315 },
    svg: 'public/mapa-vyskov.svg',
    json: 'src/lib/mapa-vyrez.json',
  },
  {
    nazev: 'obec',
    vyrez: { jih: 49.2542, sever: 49.3388, zapad: 16.8995, vychod: 17.0327 },
    svg: 'public/mapa-obec.svg',
    json: 'src/lib/mapa-vyrez-obec.json',
  },
];

// --- Roztrideni do vrstev --------------------------------------------------

// V OpenStreetMap se Hana jmenuje `river` az od soutoku pod Dedicemi; nad nim
// jsou to `stream` Velka Hana a Mala Hana. Podle znacky by se tedy zelene
// vykreslila jen dolni tretina toku a zbytek by splynul s potoky, prestoze je
// to porad tataz reka - a prave ta, kterou mame v programu.
// Jmena musi sedet znak po znaku s daty, proto tady s diakritikou - narozdil
// od hlasek, ktere skript tiskne do konzole.
const JMENA_REKY = new Set(['Haná', 'Velká Haná', 'Malá Haná']);


function vrstva(prvek) {
  const t = prvek.tags ?? {};
  if (t.landuse) return t.landuse === 'residential' ? 'zastavba' : 'prumysl';
  if (t.leisure) return 'zelen';
  if (t.natural === 'water') return 'vodni-plocha';
  if (t.waterway === 'river' || JMENA_REKY.has(t.name)) return 'reka';
  if (t.waterway) return 'potok';
  if (t.railway) return 'zeleznice';
  if (['motorway', 'trunk', 'primary'].includes(t.highway)) return 'silnice-hlavni';
  if (['secondary', 'tertiary'].includes(t.highway)) return 'silnice';
  // Vlastni vrstva pro to nejdrobnejsi: prijezdy k domum, chodniky, cyklostezky
  // a schody. Ve meste tvori vetsinu site a bez nich mezi ulicemi zeje prazdno,
  // ale kdyby se kreslily jako ulice, mapa by se zaplevelila - proto slabsim
  // tahem a tlumeneji.
  //
  // Polni a lesni cesty (`track`, `path`) se nestahuji vubec. Delaly skoro
  // polovinu vsech drobnych cest, lezi temer cele mimo mesto a mapu v polich
  // zaplevelily pavucinou, ktera nikam nevede. Mapa ma ukazat mesto.
  if (['service', 'footway', 'cycleway', 'steps'].includes(t.highway)) {
    return 'cesta';
  }
  return 'ulice';
}

const PLOCHY = new Set(['zastavba', 'prumysl', 'zelen', 'vodni-plocha']);

/** Poradi vykreslovani: co je vys v seznamu, to je vespod. */
const PORADI = [
  'zastavba', 'prumysl', 'zelen', 'vodni-plocha',
  'cesta', 'ulice', 'zeleznice', 'silnice', 'silnice-hlavni',
  'potok', 'reka',
];

// --- Stazeni dat -----------------------------------------------------------

async function zkusOpakovane(dotaz, pokusu = 4) {
  for (let pokus = 1; ; pokus++) {
    // Overpass odmita pozadavky bez hlavicky User-Agent (odpovi 406),
    // takze se slusne predstavime.
    const odpoved = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'transparentnivyskov.cz generator mapy (jednorazove)',
      },
      body: new URLSearchParams({ data: dotaz }),
    });
    if (odpoved.ok) return await odpoved.json();

    const prechodne = [429, 502, 503, 504].includes(odpoved.status);
    if (!prechodne || pokus === pokusu) {
      throw new Error('Overpass odpovedel ' + odpoved.status);
    }
    const cekat = pokus * 15;
    console.log(`   Overpass ma napilno (${odpoved.status}), zkusim za ${cekat} s`);
    await new Promise((hotovo) => setTimeout(hotovo, cekat * 1000));
  }
}


async function stahniData(mapa) {
  const mezipamet = `nastroje/.mapa-data-${mapa.nazev}.json`;
  const v = mapa.vyrez;
  const bbox = `${v.jih},${v.zapad},${v.sever},${v.vychod}`;

  const dotaz = `[out:json][timeout:180];
(
  way["landuse"~"^(residential|industrial|commercial|retail)$"](${bbox});
  way["leisure"~"^(park|garden)$"](${bbox});
  way["waterway"~"^(river|stream)$"](${bbox});
  way["natural"="water"](${bbox});
  way["railway"="rail"](${bbox});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service|footway|cycleway|steps)$"](${bbox});
);
out geom;`;

  // Klic je otisk celeho dotazu - a protoze je v dotazu i vyrez, hlida oboji
  // najednou. Driv se klicoval jen vyrezem a po pridani dalsiho druhu cest by
  // se tise pouzila stara data. To je chyba, kterou nejde poznat: mapa vypada
  // v poradku, jen v ni neco chybi.
  const klic = crypto.createHash('sha256').update(dotaz).digest('hex').slice(0, 16);

  if (fs.existsSync(mezipamet)) {
    const ulozene = JSON.parse(fs.readFileSync(mezipamet, 'utf8'));
    if (ulozene.klicVyrezu === klic) {
      console.log('   pouzivam ulozena data z ' + mezipamet);
      return ulozene;
    }
    console.log('   vyrez nebo dotaz se zmenil, stahuji data znovu');
  }

  console.log('   stahuji data z OpenStreetMap...');
  // Overpass odmita pozadavky bez hlavicky User-Agent (odpovi 406),
  // takze se slusne predstavime.
  // Overpass je verejna sluzba zdarma a kdyz ma napilno, odpovi 504 nebo 429.
  // Neni to chyba dotazu - za chvili tentyz dotaz projde. Bez opakovani to
  // navic konci hur, nez by se zdalo: mapy se vyrabeji po jedne, takze pad
  // u druhe necha v repozitari jednu mapu novou a druhou starou.
  const data = await zkusOpakovane(dotaz);
  data.klicVyrezu = klic;
  fs.writeFileSync(mezipamet, JSON.stringify(data));
  console.log('   ulozeno do ' + mezipamet + ' (' + data.elements.length + ' prvku)');
  return data;
}

// --- Vyroba jedne mapy -----------------------------------------------------

async function vyrobMapu(mapa) {
  console.log('\n>> Mapa "' + mapa.nazev + '"');
  const data = await stahniData(mapa);
  const v = mapa.vyrez;

  // Mercator: pri tehle velikosti by stacila i primka, ale spravna projekce
  // stoji tri radky a mesto pak nevypada natazene na vysku.
  const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
  const yJih = merkator(v.jih);
  const meritko = SIRKA / (v.vychod - v.zapad);
  const vyska = Math.round((merkator(v.sever) - yJih) * (180 / Math.PI) * meritko);

  const bod = (p) => [
    Math.round((p.lon - v.zapad) * meritko * 10) / 10,
    Math.round((vyska - (merkator(p.lat) - yJih) * (180 / Math.PI) * meritko) * 10) / 10,
  ];

  // Body daleko za vyrezem se zahazuji a cesta se v tom miste pretrhne,
  // aby dalnice mirici pryc netahla do souboru stovky zbytecnych souradnic.
  const okraj = SIRKA * 0.2;
  const uvnitr = ([x, y]) => x > -okraj && x < SIRKA + okraj && y > -okraj && y < vyska + okraj;

  function cesta(geometrie, uzavrena) {
    const useky = [];
    let usek = [];
    for (const g of geometrie) {
      const b = bod(g);
      if (uvnitr(b)) usek.push(b);
      else if (usek.length) {
        usek.push(b); // jeden bod za okrajem, at cara dojede ke kraji
        useky.push(usek);
        usek = [];
      }
    }
    if (usek.length) useky.push(usek);

    return useky
      .map((body) => {
        // Vyhodit body, ktere po zaokrouhleni splynuly se sousedem
        const cistne = body.filter((b, i) => i === 0 || b[0] !== body[i - 1][0] || b[1] !== body[i - 1][1]);
        if (cistne.length < 2) return '';
        const d = 'M' + cistne.map((b) => b.join(',')).join('L');
        return uzavrena ? d + 'Z' : d;
      })
      .filter(Boolean)
      .join('');
  }

  const skupiny = Object.fromEntries(PORADI.map((n) => [n, []]));
  for (const prvek of data.elements) {
    if (!prvek.geometry || prvek.geometry.length < 2) continue;
    const n = vrstva(prvek);
    if (!skupiny[n]) continue;
    const d = cesta(prvek.geometry, PLOCHY.has(n));
    if (d) skupiny[n].push(d);
  }

  const casti = PORADI.filter((n) => skupiny[n].length).map(
    (n) => `  <g class="mapa-${n}">\n` + skupiny[n].map((d) => `    <path d="${d}"/>`).join('\n') + '\n  </g>',
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIRKA} ${vyska}" aria-hidden="true" focusable="false">
<!-- Podklad vygenerovany skriptem nastroje/mapa.mjs - needitovat rucne.
     Data (c) prispevatele OpenStreetMap, licence ODbL. -->
${casti.join('\n')}
</svg>
`;

  fs.mkdirSync(path.dirname(mapa.svg), { recursive: true });
  fs.writeFileSync(mapa.svg, svg);

  // Vyrez si ukladame vedle mapy. Body zameru jsou v datech ulozene jako
  // zemepisne souradnice a web si z nich polohu na mape dopocita prave podle
  // tohohle souboru — takze kdyz se vyrez zmeni, body se posunou samy.
  fs.writeFileSync(mapa.json, JSON.stringify({ ...v, sirka: SIRKA, vyska }, null, 2) + '\n');

  console.log('   ' + mapa.svg + '  (' + SIRKA + ' x ' + vyska + ', ' + Math.round(svg.length / 1024) + ' kB)');
  console.log('   ' + mapa.json);
  for (const n of PORADI) if (skupiny[n].length) console.log('     ' + n.padEnd(16) + skupiny[n].length);
}

for (const mapa of MAPY) await vyrobMapu(mapa);
console.log('\nHotovo.');
