/**
 * Vyrobi podkladovou mapu Vyskova jako SVG: nastroje/mapa.mjs
 *
 *   node nastroje/mapa.mjs
 *
 * Data se stahuji z OpenStreetMap pres Overpass API. Delaji se JEDNOU
 * a vysledek (public/mapa-vyskov.svg) se commituje, takze hotovy web
 * uz nikam nesaha - zadna mapova sluzba, zadne trackovani navstevniku,
 * zadne cekani na cizi server. To je u strany s timhle nazvem podstatne.
 *
 * SVG zamerne neobsahuje zadne barvy. Vsechno se obarvuje az v CSS
 * pres tridy, aby mapa sedla do tmaveho pasu i na svetle pozadi.
 *
 * Data (c) prispevatele OpenStreetMap, licence ODbL.
 */

import fs from 'node:fs';

// Vyrez kolem mesta. Sirsi zaber uz zabira okolni obce a mesto se v nem ztraci.
const VYREZ = { jih: 49.2636, sever: 49.3024, zapad: 16.9485, vychod: 17.0315 };
const SIRKA = 1000;
const CIL = 'public/mapa-vyskov.svg';
const VYREZ_JSON = 'src/lib/mapa-vyrez.json';
const MEZIPAMET = 'nastroje/.mapa-data.json';

const DOTAZ = `[out:json][timeout:120];
(
  way["landuse"~"^(residential|industrial|commercial|retail)$"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
  way["leisure"~"^(park|garden)$"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
  way["waterway"~"^(river|stream)$"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
  way["natural"="water"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
  way["railway"="rail"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](${VYREZ.jih},${VYREZ.zapad},${VYREZ.sever},${VYREZ.vychod});
);
out geom;`;

async function stahniData() {
  if (fs.existsSync(MEZIPAMET)) {
    console.log('Pouzivam ulozena data z ' + MEZIPAMET);
    return JSON.parse(fs.readFileSync(MEZIPAMET, 'utf8'));
  }
  console.log('Stahuji data z OpenStreetMap...');
  // Overpass odmita pozadavky bez hlavicky User-Agent (odpovi 406),
  // takze se slusne predstavime.
  const odpoved = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'transparentnivyskov.cz generator mapy (jednorazove)',
    },
    body: new URLSearchParams({ data: DOTAZ }),
  });
  if (!odpoved.ok) throw new Error('Overpass odpovedel ' + odpoved.status);
  const data = await odpoved.json();
  fs.writeFileSync(MEZIPAMET, JSON.stringify(data));
  console.log('Ulozeno do ' + MEZIPAMET + ' (' + data.elements.length + ' prvku)');
  return data;
}

// --- Prevod zemepisnych souradnic na body v obrazku ------------------------
// Mercator: pri tehle velikosti by stacila i primka, ale spravna projekce
// stoji tri radky a mesto pak nevypada natazene na vysku.

const merkator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

const yJih = merkator(VYREZ.jih);
const ySever = merkator(VYREZ.sever);
const MERITKO = SIRKA / (VYREZ.vychod - VYREZ.zapad);
const VYSKA = Math.round((ySever - yJih) * (180 / Math.PI) * MERITKO);

function bod(p) {
  const x = (p.lon - VYREZ.zapad) * MERITKO;
  const y = VYSKA - (merkator(p.lat) - yJih) * (180 / Math.PI) * MERITKO;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** Body daleko za vyrezem se zahazuji a cesta se v tom miste preterhne,
    aby dalnice mirici pryc netahla do souboru stovky zbytecnych souradnic. */
const OKRAJ = SIRKA * 0.2;
const uvnitr = ([x, y]) => x > -OKRAJ && x < SIRKA + OKRAJ && y > -OKRAJ && y < VYSKA + OKRAJ;

function cesta(geometrie, uzavrena) {
  const useky = [];
  let usek = [];
  for (const g of geometrie) {
    const b = bod(g);
    if (uvnitr(b)) usek.push(b);
    else if (usek.length) {
      usek.push(b); // jeden bod za okrajem, at cara dojede ke krajl
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

// --- Roztrideni do vrstev --------------------------------------------------

function vrstva(prvek) {
  const t = prvek.tags ?? {};
  if (t.landuse) return t.landuse === 'residential' ? 'zastavba' : 'prumysl';
  if (t.leisure) return 'zelen';
  if (t.natural === 'water') return 'vodni-plocha';
  if (t.waterway === 'river') return 'reka';
  if (t.waterway) return 'potok';
  if (t.railway) return 'zeleznice';
  if (['motorway', 'trunk', 'primary'].includes(t.highway)) return 'silnice-hlavni';
  if (['secondary', 'tertiary'].includes(t.highway)) return 'silnice';
  return 'ulice';
}

const PLOCHY = new Set(['zastavba', 'prumysl', 'zelen', 'vodni-plocha']);

// Poradi vykreslovani: co je vys v seznamu, to je vespod.
const PORADI = [
  'zastavba', 'prumysl', 'zelen', 'vodni-plocha',
  'ulice', 'zeleznice', 'silnice', 'silnice-hlavni',
  'potok', 'reka',
];

const data = await stahniData();

const skupiny = Object.fromEntries(PORADI.map((v) => [v, []]));
for (const prvek of data.elements) {
  if (!prvek.geometry || prvek.geometry.length < 2) continue;
  const v = vrstva(prvek);
  if (!skupiny[v]) continue;
  const d = cesta(prvek.geometry, PLOCHY.has(v));
  if (d) skupiny[v].push(d);
}

const casti = PORADI.filter((v) => skupiny[v].length).map(
  (v) => `  <g class="mapa-${v}">\n` + skupiny[v].map((d) => `    <path d="${d}"/>`).join('\n') + '\n  </g>',
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIRKA} ${VYSKA}" aria-hidden="true" focusable="false">
<!-- Podklad vygenerovany skriptem nastroje/mapa.mjs - needitovat rucne.
     Data (c) prispevatele OpenStreetMap, licence ODbL. -->
${casti.join('\n')}
</svg>
`;

fs.writeFileSync(CIL, svg);

// Výřez si ukládáme vedle mapy. Body záměrů jsou v datech uložené jako
// zeměpisné souřadnice a web si z nich polohu na mapě dopočítá právě podle
// tohohle souboru — takže když se výřez změní, body se posunou samy.
fs.writeFileSync(
  VYREZ_JSON,
  JSON.stringify({ ...VYREZ, sirka: SIRKA, vyska: VYSKA }, null, 2) + '\n',
);

console.log('\nHotovo: ' + CIL);
console.log('        ' + VYREZ_JSON);
console.log('  rozmer ' + SIRKA + ' x ' + VYSKA);
console.log('  velikost ' + Math.round(svg.length / 1024) + ' kB');
for (const v of PORADI) if (skupiny[v].length) console.log('  ' + v.padEnd(16) + skupiny[v].length);
