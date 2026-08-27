/**
 * Jednorázový skript — založí soubory kandidátů předvyplněné údaji
 * z původního webu transparentnivyskov.cz/kandidatka/.
 *
 * Spouští se jen jednou, na začátku projektu:  node nastroje/zaloz-kandidaty.mjs
 * Existující soubory NEPŘEPISUJE, takže se dá pustit znovu, aniž by to
 * smazalo dopsané medailonky.
 *
 * Zůstává v repozitáři jako doklad o tom, odkud se data vzala.
 */

import fs from 'node:fs';
import path from 'node:path';

const CIL = 'src/content/kandidati';

/** Přepis kandidátní listiny. Pole `temata` je NÁVRH odvozený z povolání —
    každý si ho má potvrdit nebo přepsat sám. */
const LIDE = [
  { poradi: 1,  jmeno: 'Bc. et Bc. Eva Formánková', vek: 51, povolani: 'učitelka, OSVČ', pusobeni: 'TJ Sokol Hamiltony', temata: ['Školství'] },
  { poradi: 2,  jmeno: 'Ing. Jakub Burian', vek: 39, povolani: 'poradce pro finance a strategický rozvoj, OSVČ', temata: ['Hospodaření'] },
  { poradi: 3,  jmeno: 'doc. Mgr. Petr Novotný, Ph.D.', vek: 54, povolani: 'docent Masarykovy univerzity, konzultant', prislusnost: 'Strana zelených', temata: ['Školství'] },
  { poradi: 4,  jmeno: 'Martina Wagnerová', vek: 51, povolani: 'OSVČ', pusobeni: 'Komunitní nadace Tři brány', temata: ['Kultura'] },
  { poradi: 5,  jmeno: 'Ing. Lenka Doleželová', vek: 40, povolani: 'referentka životního prostředí', temata: ['Zeleň a voda'] },
  { poradi: 6,  jmeno: 'Veronika Červinková', vek: 47, povolani: 'referentka prodeje', temata: [] },
  { poradi: 7,  jmeno: 'Mgr. Eva Poláčková', vek: 43, povolani: 'učitelka na gymnáziu', temata: ['Školství'] },
  { poradi: 8,  jmeno: 'Tereza Vinklerová', vek: 29, povolani: 'osobní asistentka v Paprsku', prislusnost: 'Strana zelených', temata: [] },
  { poradi: 9,  jmeno: 'Lukáš Průcha', vek: 46, povolani: 'státní zaměstnanec, OSVČ', pusobeni: 'Divadlo Haná, TJ Sokol Hamiltony', temata: ['Kultura'] },
  { poradi: 10, jmeno: 'Mgr. Renata Máslová', vek: 43, povolani: 'učitelka na gymnáziu', temata: ['Školství'] },
  { poradi: 11, jmeno: 'Ing. Marek Suchomel', vek: 59, povolani: 'IT analytik, lektor line dance', prislusnost: 'Strana zelených', temata: [] },
  { poradi: 12, jmeno: 'Ing. Antonín Bílý', vek: 60, povolani: 'strojní konstruktér', prislusnost: 'příznivec České pirátské strany', temata: [] },
  { poradi: 13, jmeno: 'Ing. Ivana Bžatková', vek: 42, povolani: 'úvěrová analytička', temata: ['Hospodaření'] },
  { poradi: 14, jmeno: 'Ondřej Formánek', vek: 21, povolani: 'student herního designu na VŠMU', temata: [] },
  { poradi: 15, jmeno: 'Maxim Sopko', vek: 20, povolani: 'student 1. lékařské fakulty UK', temata: [] },
  { poradi: 16, jmeno: 'Ing. Roman Hrnčiřík', vek: 46, povolani: 'učitel ekonomických předmětů na střední škole', temata: ['Školství', 'Hospodaření'] },
  { poradi: 17, jmeno: 'Bc. Iveta Adámková', vek: 40, povolani: 'finanční poradkyně, OSVČ', pusobeni: 'Divadlo Haná, TJ Sokol Hamiltony', temata: ['Hospodaření', 'Kultura'] },
  { poradi: 18, jmeno: 'Petr Opletal', vek: 44, povolani: 'živnostník, OSVČ', temata: ['Podnikání'] },
  { poradi: 19, jmeno: 'Ing. Jan Buřival', vek: 75, povolani: 'přírodovědec, lektor jógy', temata: ['Zeleň a voda'] },
  { poradi: 20, jmeno: 'Mgr. Vojtěch Liška, Ph.D.', vek: 31, povolani: 'výzkumník kvantové optiky', prislusnost: 'příznivec České pirátské strany', temata: [] },
  { poradi: 21, jmeno: 'Gabriela Zabloudilová', vek: 48, povolani: 'vedoucí skladu MTZ v Nemocnici Vyškov', temata: [] },
  { poradi: 22, jmeno: 'Anna Novotná', vek: 54, povolani: 'back office ředitelka v cestovní agentuře', temata: [] },
  { poradi: 23, jmeno: 'Jaroslava Daňková', vek: 50, povolani: 'zdravotní sestra', temata: [] },
  { poradi: 24, jmeno: 'Mgr. Irena Mikulová', vek: 42, povolani: 'marketingová specialistka, masérka', temata: [] },
  { poradi: 25, jmeno: 'Petr Pokorný', vek: 53, povolani: 'prodavač', temata: [] },
  { poradi: 26, jmeno: 'Ing. Jan Kyselák, Ph.D.', vek: 64, povolani: 'vysokoškolský učitel na Univerzitě Tomáše Bati', temata: ['Školství'] },
  { poradi: 27, jmeno: 'Mgr. Jiří Kopřiva', vek: 61, povolani: 'speciální pedagog', temata: ['Školství'] },
];

const DIAKRITIKA = /\p{Mn}/gu;
const TITULY = /\b(Bc|Mgr|Ing|MUDr|JUDr|PhDr|RNDr|MgA|doc|prof|Ph\.?D|CSc|DiS|et)\.?\b/g;

function slug(jmeno) {
  return jmeno
    .replace(TITULY, ' ')
    .replace(/,/g, ' ')
    .normalize('NFD')
    .replace(DIAKRITIKA, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** YAML hodnota — do uvozovek jen když je potřeba, ať se to dobře čte. */
function yaml(hodnota) {
  if (typeof hodnota === 'number') return String(hodnota);
  return /[:#'"[\]{}]|^\s|\s$/.test(hodnota) ? JSON.stringify(hodnota) : hodnota;
}

fs.mkdirSync(CIL, { recursive: true });

let zalozeno = 0;
let preskoceno = 0;

for (const clovek of LIDE) {
  const nazev = `${String(clovek.poradi).padStart(2, '0')}-${slug(clovek.jmeno)}.md`;
  const cesta = path.join(CIL, nazev);

  if (fs.existsSync(cesta)) {
    preskoceno++;
    continue;
  }

  const radky = [
    '---',
    `poradi: ${clovek.poradi}`,
    `jmeno: ${yaml(clovek.jmeno)}`,
    `vek: ${clovek.vek}`,
    `povolani: ${yaml(clovek.povolani)}`,
  ];

  if (clovek.pusobeni) radky.push(`pusobeni: ${yaml(clovek.pusobeni)}`);
  if (clovek.prislusnost) radky.push(`prislusnost: ${yaml(clovek.prislusnost)}`);

  radky.push(
    clovek.temata.length
      ? `temata: [${clovek.temata.map(yaml).join(', ')}]   # NÁVRH odvozený z povolání — potvrďte nebo přepište`
      : 'temata: []   # doplňte 1–3 oblasti ze seznamu v src/lib/temata.ts',
    'citace:   # jedna věta, která se na medailonku vytáhne velkým písmem',
    '---',
    '',
    '<!-- Text medailonku. Klidně několik odstavců — dá se překopírovat',
    '     z medailonku na Facebooku. Prázdné nevadí, stránka se vykreslí bez něj. -->',
    '',
  );

  fs.writeFileSync(cesta, radky.join('\n'), 'utf8');
  zalozeno++;
}

console.log(`Zalozeno: ${zalozeno}   Preskoceno (uz existuji): ${preskoceno}`);
