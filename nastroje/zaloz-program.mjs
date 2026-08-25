/**
 * Jednorázový skript — založí soubory programových oblastí podle
 * původního webu transparentnivyskov.cz/program/.
 *
 *   node nastroje/zaloz-program.mjs
 *
 * Existující soubory nepřepisuje.
 */

import fs from 'node:fs';
import path from 'node:path';

const CIL = 'src/content/program';

const OBLASTI = [
  {
    soubor: '1-transparentni-sprava',
    nazev: 'Transparentní správa',
    tema: 'Hospodaření',
    shrnuti: 'Smlouvy, zakázky a hospodaření města na jednom místě, kde si je kdokoliv zkontroluje.',
    body: [
      'Zveřejňovat smlouvy, zakázky a hospodaření města tak, aby si je občan našel a porozuměl jim.',
      'Férové veřejné zakázky s jasnými pravidly.',
      'Participativní rozpočet — o části městských peněz rozhodnou přímo obyvatelé.',
    ],
  },
  {
    soubor: '2-dostupne-bydleni',
    nazev: 'Dostupné bydlení',
    tema: 'Bydlení',
    shrnuti: 'Bydlení pro lidi, kteří tu chtějí žít — ne pro developery. A pravidla, která platí pro všechny stejně.',
    body: [
      'Pilotní projekt družstevního bydlení.',
      'Jasná pravidla spolupráce s investory.',
      'Férová pravidla pro přidělování městských bytů.',
      'Rozvoj fondu obecních bytů místo rozprodávání majetku.',
    ],
  },
  {
    soubor: '3-zelen-voda-stin',
    nazev: 'Zeleň, voda, stín',
    tema: 'Zeleň a voda',
    shrnuti: 'Otevřít řeku lidem, sázet stromy a zadržet vodu ve městě, dokud je čas.',
    body: [
      'Otevřít řeku a doplnit ji o místa k odpočinku.',
      'Výsadba stromů a odolných rostlin, které zvládnou horká léta.',
      'Zadržování dešťové vody místo odvádění do kanalizace.',
      'Architektonické soutěže na veřejná prostranství.',
    ],
  },
  {
    soubor: '4-podpora-podnikani',
    nazev: 'Podpora podnikání',
    tema: 'Podnikání',
    shrnuti: 'Živé centrum a město, které drobným živnostníkům nestojí v cestě.',
    body: [
      'Podnikatelský hub jako místo, kde se lidé potkají.',
      'Oživení centra města.',
      'Pravidelná setkávání vedení města s podnikateli.',
      'Mikrodotace pro nové živnosti.',
    ],
  },
  {
    soubor: '5-skolstvi',
    nazev: 'Školství',
    tema: 'Školství',
    shrnuti: 'Školy, které učí moderně, a ředitelé vybíraní podle schopností, ne podle známostí.',
    body: [
      'Podpora moderních metod výuky.',
      'Transparentní výběr ředitelů škol.',
      'Školské rady, které skutečně fungují.',
      'Podpora speciálních pedagogů.',
    ],
  },
  {
    soubor: '6-bezpecne-mesto',
    nazev: 'Bezpečné město',
    tema: 'Bezpečnost',
    shrnuti: 'Prevence místo represe — a mapa míst, kde se lidé bojí chodit.',
    body: [
      'Prevence kriminality tam, kde má smysl.',
      'Pocitová mapa bezpečnosti sestavená s obyvateli.',
      'Spolupráce městské policie, státní policie a sociálních služeb.',
    ],
  },
  {
    soubor: '7-kultura',
    nazev: 'Kultura',
    tema: 'Kultura',
    shrnuti: 'Peníze na kulturu rozdělované podle jasných pravidel a podpora těch, kdo tvoří tady.',
    body: [
      'Rekonstrukce kulturních budov.',
      'Transparentní financování kultury podle jasných kritérií.',
      'Podpora místních umělců a spolků.',
      'Vratné obaly na městských akcích.',
    ],
  },
  {
    soubor: '8-bezpecny-pohyb',
    nazev: 'Bezpečný pohyb',
    tema: 'Doprava',
    shrnuti: 'Propojit město tak, aby se dalo bezpečně projít i projet na kole.',
    body: [
      'Bezpečné trasy pro pěší a cyklisty napříč městem.',
      'Propojení částí města, které dnes odděluje doprava.',
    ],
  },
];

fs.mkdirSync(CIL, { recursive: true });

let zalozeno = 0;
let preskoceno = 0;

OBLASTI.forEach((oblast, index) => {
  const cesta = path.join(CIL, `${oblast.soubor}.md`);
  if (fs.existsSync(cesta)) {
    preskoceno++;
    return;
  }

  const obsah = [
    '---',
    `poradi: ${index + 1}`,
    `nazev: ${oblast.nazev}`,
    `tema: ${oblast.tema}`,
    `shrnuti: ${JSON.stringify(oblast.shrnuti)}`,
    '---',
    '',
    ...oblast.body.map((b) => `- ${b}`),
    '',
  ].join('\n');

  fs.writeFileSync(cesta, obsah, 'utf8');
  zalozeno++;
});

console.log(`Zalozeno: ${zalozeno}   Preskoceno: ${preskoceno}`);
