/**
 * Vyrobi z programu podklady pro Google Docs:
 *
 *   node nastroje/dokument-program.mjs
 *
 * Do slozky `dokument/` napise sest souboru - jeden s celym programem v bodech
 * a pak jeden na kazdou podrobne rozepsanou oblast. Kazdy z nich je jedna
 * karta v Google Docs.
 *
 * Karty se nedaji vyrobit nahranim souboru, at je format jakykoliv: je to
 * funkce samotneho Google Docs a nahrany dokument se vzdycky otevre jako jedna
 * karta. Vyrobit se daji jen rucne, nebo pres Google Docs API. Rozdelene
 * soubory z toho aspon delaji mechanickou praci.
 *
 * Proc `.docx` a ne treba PDF: Google Docs ho po nahrani prevede na svuj
 * dokument, ve kterem jde dal psat. Nadpisy si prenese jako svoje styly, takze
 * v dokumentu funguje osnova a da se v nem preskakovat.
 *
 * Proc generator a ne rovnou napsany soubor: program se jeste bude menit
 * a rucne psany dokument by se rozesel s webem. Tenhle se vyrabi z tychz
 * souboru, ze kterych se sklada web, takze rozejit se nemuze.
 *
 * `.docx` je zip s XML uvnitr. Node zipovat neumi a knihovnu si kvuli jednomu
 * skriptu do projektu tahat nechceme, takze se archiv sklada tady - je to
 * kousek nize a neni to nic sloziteho. Soubory se ukladaji nezabalene
 * (metoda 0), protoze par desitek kilobajtu XML nema smysl komprimovat.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Vase podklady lezi primo v `dokument/`, generovane soubory jdou stranou
// do `dokument/karty/`, at se to neplete.
const PODKLADY = path.join(KOREN, 'dokument');
const SLOZKA = path.join(PODKLADY, 'karty');

const NADPIS_DOKUMENTU = 'Program Transparentní Vyškov';
const PODNADPIS = 'Komunální volby 9. a 10. října 2026';
const ZAHLAVI = 'Program Transparentní Vyškov · volby 9. a 10. října 2026';

// --- Cteni obsahu ----------------------------------------------------------

/** Rozdeli soubor na hlavicku mezi `---` a text pod ni. */
function rozeber(soubor) {
  const text = fs.readFileSync(soubor, 'utf8').replace(/\r\n/g, '\n');
  const shoda = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!shoda) throw new Error('Soubor nema hlavicku mezi ---: ' + soubor);

  const hlava = {};
  for (const radek of shoda[1].split('\n')) {
    const dvojtecka = radek.indexOf(':');
    if (dvojtecka < 0) continue;
    const klic = radek.slice(0, dvojtecka).trim();
    let hodnota = radek.slice(dvojtecka + 1).trim();
    const uvozovky = ['"', "'"];
    if (uvozovky.includes(hodnota[0]) && hodnota.at(-1) === hodnota[0]) {
      hodnota = hodnota.slice(1, -1);
    }
    hlava[klic] = hodnota;
  }
  return { hlava, telo: text.slice(shoda[0].length).trim() };
}

/**
 * Kde se bere text.
 *
 * Dokumenty se pripominkuji drive, nez se sahne na web, takze se pracuje
 * v kopii `dokument/zdroj/`. Dokud existuje, cte se z ni; kdyz se smaze, cte
 * se zase primo z webu. Az budou zmeny odsouhlasene, kopie se nastehuje zpatky
 * do `src/content/` a smaze.
 */
function nactiSlozku(podadresar) {
  const kopie = path.join(PODKLADY, 'zdroj', podadresar);
  const slozka = fs.existsSync(kopie) ? kopie : path.join(KOREN, 'src', 'content', podadresar);
  return fs
    .readdirSync(slozka)
    .filter((jmeno) => jmeno.endsWith('.md') && !jmeno.startsWith('_'))
    .map((jmeno) => ({ jmeno: jmeno.replace(/\.md$/, ''), ...rozeber(path.join(slozka, jmeno)) }));
}

// --- Skladani XML ----------------------------------------------------------

function xml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function beh(text, vyznam) {
  const rPr = vyznam ? `<w:rPr>${vyznam}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

/**
 * Text na behy. Umi `**tucne**` a `*kurzivu*`, tedy to, co se v programu
 * pouziva. Deli se nadvakrat a bez regularniho vyrazu: nejdriv se text rozseka
 * po dvou hvezdickach a teprve co zbyde, po jedne. Naopak by to neslo - jedna
 * hvezdicka by rozsekala i ty dvojite.
 */
function behy(text) {
  const ven = [];
  text.split('**').forEach((cast, tucnyDil) => {
    if (tucnyDil % 2 === 1) {
      if (cast) ven.push(beh(cast, '<w:b/>'));
      return;
    }
    cast.split('*').forEach((kus, kurzivnyDil) => {
      if (kus) ven.push(beh(kus, kurzivnyDil % 2 === 1 ? '<w:i/>' : ''));
    });
  });
  return ven.join('');
}

function odstavec(text, styl = null, odrazka = false) {
  const vlastnosti = [];
  if (styl) vlastnosti.push(`<w:pStyle w:val="${styl}"/>`);
  if (odrazka) vlastnosti.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  const pPr = vlastnosti.length ? `<w:pPr>${vlastnosti.join('')}</w:pPr>` : '';
  return `<w:p>${pPr}${behy(text)}</w:p>`;
}

const zlomStranky = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * Logo do zahlavi karty.
 *
 * Bere se z `public/logo.svg`, tedy z tehoz souboru jako na webu - jeden zdroj
 * pravdy. Word ale se SVG spolehlive neumi, takze se pri kazdem spusteni
 * prevede na PNG.
 *
 * Rozmer se pocita v EMU, coz je jednotka, ve ktere Word kresby meri:
 * 914400 EMU je jeden palec. Vyska se dopocitava z pomeru stran obrazku, aby
 * se logo nedeformovalo.
 */
const PALEC = 914400;
const SIRKA_LOGA = Math.round(1.8 * PALEC);

async function pripravLogo() {
  const zdroj = path.join(KOREN, 'public', 'logo.svg');
  const data = await sharp(zdroj).resize({ width: 900 }).png().toBuffer();
  const { width, height } = await sharp(data).metadata();
  return { data, vyska: Math.round((SIRKA_LOGA * height) / width) };
}

function obrazekLoga(vyska) {
  return (
    '<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${SIRKA_LOGA}" cy="${vyska}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    '<wp:docPr id="1" name="Transparentní Vyškov"/>' +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic>' +
    '<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rId4"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SIRKA_LOGA}" cy="${vyska}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    // Bez tohohle si Word kolem obrazku nakresli tenky obrys.
    '<a:ln><a:noFill/></a:ln></pic:spPr>' +
    '</pic:pic>' +
    '</a:graphicData></a:graphic>' +
    '</wp:inline>' +
    '</w:drawing></w:r></w:p>'
  );
}

/**
 * Prevede text podrobneho rozpisu na odstavce.
 *
 * Kazdy neprazdny radek je jeden odstavec - v techhle souborech se odstavce
 * oddeluji prazdnym radkem a nezalamuji se uprostred, takze radky spojovat
 * netreba.
 */
function zMarkdownu(telo) {
  const ven = [];
  for (const radek of telo.split('\n')) {
    const r = radek.trim();
    if (!r) continue;
    if (r.startsWith('### ')) ven.push(odstavec(r.slice(4), 'Heading3'));
    else if (r.startsWith('## ')) ven.push(odstavec(r.slice(3), 'Heading2'));
    else if (r.startsWith('# ')) ven.push(odstavec(r.slice(2), 'Heading2'));
    else if (r.startsWith('- ')) ven.push(odstavec(r.slice(2), 'ListParagraph', true));
    else ven.push(odstavec(r));
  }
  return ven;
}

// --- Casti dokumentu -------------------------------------------------------

const HLAVICKA_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const JMENNY_PROSTOR = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const JMENNY_PROSTOR_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
// Obrazek ve Wordu je kresba (DrawingML), proto ty tri dalsi jmenne prostory.
const JMENNE_PROSTORY_OBRAZKU = [
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(' ');

const TYPY_OBSAHU = `${HLAVICKA_XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
</Types>`;

const VZTAHY_BALICKU = `${HLAVICKA_XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const VZTAHY_DOKUMENTU = `${HLAVICKA_XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>
</Relationships>`;

// Odrazky. Bez teto casti by odstavce se seznamem byly jen odsazeny text.
const CISLOVANI = `${HLAVICKA_XML}
<w:numbering ${JMENNY_PROSTOR}>
<w:abstractNum w:abstractNumId="0">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="•"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
</w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

// Barvy jsou z loga, stejne jako na webu: modra na nadpisy oblasti, tmava
// modroseda na text. Zelena z loga ma na bilem pozadi maly kontrast, takze
// se na pismo nepouziva ani tady.
const STYLY = `${HLAVICKA_XML}
<w:styles ${JMENNY_PROSTOR}>
<w:docDefaults>
<w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
<w:color w:val="0E1D28"/>
<w:sz w:val="22"/><w:szCs w:val="22"/>
<w:lang w:val="cs-CZ"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>
<w:rPr><w:b/><w:color w:val="0E1D28"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading1">
<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="0" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:color w:val="1D6EB0"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2">
<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr>
<w:rPr><w:b/><w:color w:val="145286"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading3">
<w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr>
<w:rPr><w:b/><w:color w:val="0E1D28"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph">
<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:after="80"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Nadtitul">
<w:name w:val="Nadtitul"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
<w:rPr><w:b/><w:color w:val="1D6EB0"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Perex">
<w:name w:val="Perex"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:after="200"/></w:pPr>
<w:rPr><w:i/><w:color w:val="5A6C78"/></w:rPr>
</w:style>
</w:styles>`;

const ZAHLAVI_XML = `${HLAVICKA_XML}
<w:hdr ${JMENNY_PROSTOR}>
<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr>
<w:r><w:rPr><w:color w:val="5A6C78"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xml(ZAHLAVI)}</w:t></w:r></w:p>
</w:hdr>`;

// --- Zip -------------------------------------------------------------------

const TABULKA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABULKA_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Slozi zip. Datum souboru je pevne, ne "ted" - jinak by kazde spusteni
 * vyrobilo jine bajty a soubor by v gitu delal zmenu i tehdy, kdyz se program
 * vubec nezmenil.
 */
function zip(soubory) {
  const DATUM = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const kusy = [];
  const zaznamy = [];
  let pozice = 0;

  for (const soubor of soubory) {
    const jmeno = Buffer.from(soubor.jmeno, 'utf8');
    const data = Buffer.isBuffer(soubor.obsah)
      ? soubor.obsah
      : Buffer.from(soubor.obsah, 'utf8');
    const kontrola = crc32(data);

    const hlavicka = Buffer.alloc(30);
    hlavicka.writeUInt32LE(0x04034b50, 0);
    hlavicka.writeUInt16LE(20, 4);
    hlavicka.writeUInt16LE(0, 6);
    hlavicka.writeUInt16LE(0, 8);
    hlavicka.writeUInt16LE(0, 10);
    hlavicka.writeUInt16LE(DATUM, 12);
    hlavicka.writeUInt32LE(kontrola, 14);
    hlavicka.writeUInt32LE(data.length, 18);
    hlavicka.writeUInt32LE(data.length, 22);
    hlavicka.writeUInt16LE(jmeno.length, 26);
    hlavicka.writeUInt16LE(0, 28);

    kusy.push(hlavicka, jmeno, data);
    zaznamy.push({ jmeno, kontrola, delka: data.length, offset: pozice });
    pozice += hlavicka.length + jmeno.length + data.length;
  }

  const zacatekAdresare = pozice;
  for (const z of zaznamy) {
    const polozka = Buffer.alloc(46);
    polozka.writeUInt32LE(0x02014b50, 0);
    polozka.writeUInt16LE(20, 4);
    polozka.writeUInt16LE(20, 6);
    polozka.writeUInt16LE(0, 8);
    polozka.writeUInt16LE(0, 10);
    polozka.writeUInt16LE(0, 12);
    polozka.writeUInt16LE(DATUM, 14);
    polozka.writeUInt32LE(z.kontrola, 16);
    polozka.writeUInt32LE(z.delka, 20);
    polozka.writeUInt32LE(z.delka, 24);
    polozka.writeUInt16LE(z.jmeno.length, 28);
    polozka.writeUInt16LE(0, 30);
    polozka.writeUInt16LE(0, 32);
    polozka.writeUInt16LE(0, 34);
    polozka.writeUInt16LE(0, 36);
    polozka.writeUInt32LE(0, 38);
    polozka.writeUInt32LE(z.offset, 42);

    kusy.push(polozka, z.jmeno);
    pozice += polozka.length + z.jmeno.length;
  }

  const konec = Buffer.alloc(22);
  konec.writeUInt32LE(0x06054b50, 0);
  konec.writeUInt16LE(0, 4);
  konec.writeUInt16LE(0, 6);
  konec.writeUInt16LE(zaznamy.length, 8);
  konec.writeUInt16LE(zaznamy.length, 10);
  konec.writeUInt32LE(pozice - zacatekAdresare, 12);
  konec.writeUInt32LE(zacatekAdresare, 16);
  konec.writeUInt16LE(0, 20);
  kusy.push(konec);

  return Buffer.concat(kusy);
}

// --- Skladani jednoho souboru ----------------------------------------------

function vyrobDocx(casti) {
  const dokument = `${HLAVICKA_XML}
<w:document ${JMENNY_PROSTOR} ${JMENNY_PROSTOR_R} ${JMENNE_PROSTORY_OBRAZKU}>
<w:body>
${casti.join('\n')}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId3"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;

  return zip([
    { jmeno: '[Content_Types].xml', obsah: TYPY_OBSAHU },
    { jmeno: '_rels/.rels', obsah: VZTAHY_BALICKU },
    { jmeno: 'word/document.xml', obsah: dokument },
    { jmeno: 'word/_rels/document.xml.rels', obsah: VZTAHY_DOKUMENTU },
    { jmeno: 'word/styles.xml', obsah: STYLY },
    { jmeno: 'word/numbering.xml', obsah: CISLOVANI },
    { jmeno: 'word/header1.xml', obsah: ZAHLAVI_XML },
    { jmeno: 'word/media/logo.png', obsah: LOGO.data },
  ]);
}

/** Jmeno souboru bez diakritiky - at se da poslat kamkoliv bez prekvapeni. */
const BEZ_HACKU = {
  á: 'a', č: 'c', ď: 'd', é: 'e', ě: 'e', í: 'i', ň: 'n', ó: 'o', ř: 'r',
  š: 's', ť: 't', ú: 'u', ů: 'u', ý: 'y', ž: 'z',
};
function nazevSouboru(text) {
  return [...text.toLowerCase()]
    .map((z) => BEZ_HACKU[z] ?? z)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Sestaveni -------------------------------------------------------------

const LOGO = await pripravLogo();

const oblasti = nactiSlozku('program').sort(
  (a, b) => Number(a.hlava.poradi) - Number(b.hlava.poradi),
);
const detaily = nactiSlozku('program-detail');

// Podrobne rozpisy se radi podle oblasti, ke ktere patri, ne podle jmena
// souboru - maji jit ve stejnem poradi jako v prehledu.
for (const detail of detaily) {
  const kam = oblasti.findIndex((o) => o.jmeno === detail.hlava.oblast);
  if (kam < 0) {
    throw new Error(
      `Podrobny rozpis "${detail.jmeno}" ukazuje na oblast "${detail.hlava.oblast}", ` +
        'ktera v src/content/program neexistuje. Opravte polozku `oblast`.',
    );
  }
  detail.poradi = kam;
}
detaily.sort((a, b) => a.poradi - b.poradi);

// Kazdy soubor je jedna karta v Google Docs. Karty se nedaji vyrobit nahranim
// souboru - je to funkce samotneho Google Docs a nahrany dokument se vzdycky
// otevre jako jedna karta. Rozdelene soubory z toho aspon delaji mechanickou
// praci: zalozit kartu, otevrit soubor, vybrat vse, vlozit.
const karty = [];

// Hlavicka karty: logo a nad nadpisem radek, ktery rekne, o jaky dokument jde.
// Stejne to maji podklady od tymu, at to spolu drzi.
const hlavicka = () => [obrazekLoga(LOGO.vyska), odstavec('VOLEBNÍ PROGRAM 2026–2030', 'Nadtitul')];

const prehled = [...hlavicka()];
prehled.push(odstavec(NADPIS_DOKUMENTU, 'Title'));
prehled.push(odstavec(PODNADPIS, 'Perex'));
prehled.push(odstavec('Program v bodech', 'Heading1'));
for (const oblast of oblasti) {
  prehled.push(odstavec(oblast.hlava.nadpis || oblast.hlava.nazev, 'Heading2'));
  prehled.push(odstavec(oblast.hlava.shrnuti, 'Perex'));
  prehled.push(...zMarkdownu(oblast.telo));
}
karty.push({ nazev: 'Program v bodech', casti: prehled });

for (const detail of detaily) {
  const casti = [...hlavicka()];
  casti.push(odstavec(detail.hlava.nadpis, 'Title'));
  if (detail.hlava.perex) casti.push(odstavec(detail.hlava.perex, 'Perex'));
  casti.push(...zMarkdownu(detail.telo));
  karty.push({ nazev: detail.hlava.nadpis, casti });
}

fs.mkdirSync(SLOZKA, { recursive: true });

const zdrojKopie = fs.existsSync(path.join(PODKLADY, 'zdroj', 'program'));
console.log('Text se bere z: ' + (zdrojKopie ? 'dokument/zdroj (pracovni kopie)' : 'src/content (web)'));
console.log('');

const nove = karty.map((karta, poradi) => ({
  jmeno: `${poradi + 1}-${nazevSouboru(karta.nazev)}.docx`,
  data: vyrobDocx(karta.casti),
}));

// Po prejmenovani oblasti by ve slozce zustal lezet soubor se starym jmenem
// a poznalo by se to az ve chvili, kdy ho nekdo nahraje. Uklizi se proto stare
// vystupy - ale JEN ty vlastni, poznane podle tvaru jmena `1-neco.docx`.
//
// Cela slozka se nemaze zamerne: lezi v ni i soubory, ktere sem daval nekdo
// jiny, a smazat je by bylo neco jineho nez uklidit po sobe.
const JE_VYSTUP = /^[0-9]+-[a-z0-9-]+\.docx$/;
for (const jmeno of fs.readdirSync(SLOZKA)) {
  if (JE_VYSTUP.test(jmeno) && !nove.some((k) => k.jmeno === jmeno)) {
    fs.rmSync(path.join(SLOZKA, jmeno));
    console.log('  smazan zastaraly ' + jmeno);
  }
}

for (const karta of nove) {
  fs.writeFileSync(path.join(SLOZKA, karta.jmeno), karta.data);
  console.log('  %s  (%s kB)', karta.jmeno.padEnd(34), String(Math.round(karta.data.length / 1024)).padStart(3));
}

console.log('');
console.log('Hotovo: ' + karty.length + ' souboru ve slozce ' + path.relative(KOREN, SLOZKA));
console.log('Kazdy je jedna karta. V Google Docs zalozte kartu, otevrete soubor,');
console.log('vyberte vse a vlozte - karty se nahranim souboru vyrobit nedaji.');
